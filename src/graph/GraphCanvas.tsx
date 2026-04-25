import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Background,
  BackgroundVariant,
  useReactFlow,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './nodes/nodeTypes';
import { useDnd } from './DndContext';
import type { NodeType } from '../types';
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react';
import styles from './GraphCanvas.module.css';

interface GraphCanvasProps {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  onNodesChange?: (changes: NodeChange[]) => void;
  onEdgesChange?: (changes: EdgeChange[]) => void;
  onConnect?: (connection: Connection) => void;
  onNodeSelect?: (nodeId: string | null) => void;
  addNode: (type: NodeType, id: string, parentId?: string, position?: { x: number; y: number }) => void;
}

let dropCounter = 0;

export function GraphCanvas({ nodes, edges, selectedNodeId, onNodesChange, onEdgesChange, onConnect, onNodeSelect, addNode }: GraphCanvasProps) {
  const { dragType } = useDnd();
  const { fitView, setCenter, getZoom, zoomIn, zoomOut, screenToFlowPosition } = useReactFlow();
  const [centerOnSelect, setCenterOnSelect] = useState(false);
  const [showRefEdges, setShowRefEdges] = useState(false);

  const visibleEdges = showRefEdges ? edges : edges.filter(e => !e.animated);

  useEffect(() => {
    if (!centerOnSelect || !selectedNodeId) return;
    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) return;
    const x = node.position.x + (node.measured?.width ?? 240) / 2;
    const y = node.position.y + (node.measured?.height ?? 120) / 2;
    setCenter(x, y, { zoom: getZoom(), duration: 300 });
  }, [selectedNodeId, centerOnSelect]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!dragType) return;
      const id = `${dragType}_${++dropCounter}`;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(dragType, id, undefined, position);
    },
    [dragType, addNode, screenToFlowPosition],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeSelect?.(node.id);
    },
    [onNodeSelect],
  );

  const onPaneClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  return (
    <div className={styles.canvas}>
      <ReactFlow
        nodes={nodes}
        edges={visibleEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.1, maxZoom: 1.5 }}
        proOptions={{ hideAttribution: true }}
      >
        <Panel position="bottom-left" className={styles.controlBar}>
          <button className={styles.controlBtn} onClick={() => zoomIn({ duration: 200 })}>+ Zoom in</button>
          <button className={styles.controlBtn} onClick={() => zoomOut({ duration: 200 })}>- Zoom out</button>
          <button className={styles.controlBtn} onClick={() => fitView({ padding: 0.1, duration: 300 })}>Fit all</button>
          <button
            className={`${styles.controlBtn} ${showRefEdges ? styles.active : ''}`}
            onClick={() => setShowRefEdges(prev => !prev)}
          >
            {showRefEdges ? '● ' : '○ '}Ref lines
          </button>
          <button
            className={`${styles.controlBtn} ${centerOnSelect ? styles.active : ''}`}
            onClick={() => setCenterOnSelect(prev => !prev)}
          >
            {centerOnSelect ? '● ' : '○ '}Follow selected
          </button>
        </Panel>
        <MiniMap
          position="bottom-right"
          nodeColor={(node) => {
            const colors: Record<string, string> = {
              source: '#5865f2',
              filter: '#43b581',
              map: '#faa61a',
              select: '#9b59b6',
              join: '#f04747',
            };
            return colors[node.type ?? ''] ?? '#5865f2';
          }}
          maskColor="rgba(0, 0, 0, 0.6)"
          bgColor="#13131a"
        />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#333" />
      </ReactFlow>
    </div>
  );
}
