import { useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './nodes/nodeTypes';
import { useDnd } from './DndContext';
import type { NodeType } from '../types';
import type { Node, Edge } from '@xyflow/react';
import styles from './GraphCanvas.module.css';

interface GraphCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodeSelect?: (nodeId: string | null) => void;
  addNode: (type: NodeType, id: string, parentId?: string) => void;
}

let dropCounter = 0;

export function GraphCanvas({ nodes, edges, onNodeSelect, addNode }: GraphCanvasProps) {
  const { dragType } = useDnd();

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!dragType) return;
      const id = `${dragType}_${++dropCounter}`;
      addNode(dragType, id);
    },
    [dragType, addNode],
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
        edges={edges}
        nodeTypes={nodeTypes}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Controls position="bottom-left" />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#333" />
      </ReactFlow>
    </div>
  );
}
