import { useState, useCallback, useRef, useEffect } from 'react';
import { ReactFlowProvider, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react';
import { DndProvider } from './graph/DndContext';
import { GraphCanvas } from './graph/GraphCanvas';
import { NodeMenu } from './graph/NodeMenu';
import { RightPanel } from './panel/RightPanel';
import { Toolbar } from './toolbar/Toolbar';
import { useGraphFromDsl, registryToFlow } from './graph/useGraphFromDsl';
import { useDslFromGraph } from './graph/useDslFromGraph';
import { evaluateDsl } from './dsl/runtime';
import { addNodeToCode as addNodeToDsl, removeNodeFromCode } from './dsl/codegen';
import { executePipeline } from './dsl/execute';
import { EXAMPLES } from './dsl/examples';
import { ErrorBoundary } from './ErrorBoundary';
import type { ExecutionResult, NodeType, GraphNode } from './types';
import styles from './App.module.css';

const defaultConfigs: Record<string, GraphNode['config']> = {
  filter: { expression: '' },
  map: { mapping: {} },
  select: { fields: [] },
  join: { nodeId: '', as: '' },
};

function AppInner() {
  const [code, setCode] = useState(EXAMPLES[0].code);
  const [results, setResults] = useState<Map<string, ExecutionResult>>(new Map());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [floatingNodes, setFloatingNodes] = useState<Node[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [managedEdges, setManagedEdges] = useState<Edge[]>([]);
  const codeRef = useRef(code);
  useEffect(() => { codeRef.current = code; }, [code]);
  const codeHistory = useRef<string[]>([]);

  const setCodeWithHistory = useCallback((newCode: string | ((prev: string) => string)) => {
    codeHistory.current.push(codeRef.current);
    if (codeHistory.current.length > 200) codeHistory.current.shift();
    setCode(newCode);
  }, []);

  const { addNode: addNodeToCode, updateConfig } = useDslFromGraph(code, setCodeWithHistory);
  const { nodes: dslNodes, edges, error } = useGraphFromDsl(code, updateConfig);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active?.closest('.cm-editor') || active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.tagName === 'SELECT') return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const prev = codeHistory.current.pop();
        if (prev !== undefined) setCode(prev);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedEdge = managedEdges.find(edge => {
          const el = document.querySelector(`[aria-label="Edge from ${edge.source} to ${edge.target}"]`);
          return el?.closest('.selected') != null;
        });

        if (selectedEdge) {
          e.preventDefault();
          const edgeType = (selectedEdge.data as { edgeType: string } | undefined)?.edgeType;
          if (edgeType === 'chain') {
            const registry = evaluateDsl(code);
            const targetNode = registry.nodes.find(n => n.id === selectedEdge.target);
            if (!targetNode) return;
            setCodeWithHistory(prev => removeNodeFromCode(prev, selectedEdge.target));
            const currentNode = nodes.find(n => n.id === selectedEdge.target);
            const position = currentNode?.position ?? { x: 100, y: 100 };
            setFloatingNodes(prev => [
              ...prev,
              { id: targetNode.id, type: targetNode.type, position, data: { label: targetNode.id, nodeType: targetNode.type, config: targetNode.config, unlinked: true } },
            ]);
          } else if (edgeType === 'join') {
            updateConfig(selectedEdge.target, 'nodeId', '""');
          }
          return;
        }

        const selectedNode = nodes.find(n => n.selected);
        if (selectedNode) {
          e.preventDefault();
          const isFloating = floatingNodes.some(n => n.id === selectedNode.id);
          if (isFloating) {
            setFloatingNodes(prev => prev.filter(n => n.id !== selectedNode.id));
          } else {
            setCodeWithHistory(prev => removeNodeFromCode(prev, selectedNode.id));
          }
          if (selectedNodeId === selectedNode.id) selectNode(null);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [managedEdges, code, nodes, floatingNodes, selectedNodeId, setCodeWithHistory, updateConfig]);

  useEffect(() => {
    setManagedEdges(edges);
  }, [edges]);

  useEffect(() => {
    const dslIds = new Set(dslNodes.map(n => n.id));
    setFloatingNodes(prev => {
      const cleaned = prev.filter(n => !dslIds.has(n.id));
      return cleaned.length === prev.length ? prev : cleaned;
    });
    setNodes(prev => {
      const prevMap = new Map(prev.map(n => [n.id, n]));
      const merged = dslNodes.map(dn => {
        const existing = prevMap.get(dn.id);
        if (existing) {
          return { ...dn, position: existing.position, selected: existing.selected, data: { ...dn.data, result: (existing.data as Record<string, unknown>).result, role: (dn.data as Record<string, unknown>).role, connected: (dn.data as Record<string, unknown>).connected } };
        }
        return dn;
      });
      const uniqueFloating = floatingNodes.filter(n => !dslIds.has(n.id));
      return [...merged, ...uniqueFloating];
    });
  }, [dslNodes, floatingNodes]);

  useEffect(() => {
    setNodes(prev => prev.map(n => {
      const result = results.get(n.id);
      return { ...n, data: { ...n.data, result } };
    }));
  }, [results]);

  const selectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id);
    setHighlightedNodeId(id);
  }, []);

  useEffect(() => {
    setNodes(prev => prev.map(n => ({
      ...n,
      selected: n.id === highlightedNodeId,
    })));
  }, [highlightedNodeId]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const filtered = changes.filter(c => c.type !== 'remove');
    setNodes(prev => applyNodeChanges(filtered, prev));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const filtered = changes.filter(c => c.type !== 'remove');
    if (filtered.length > 0) {
      setManagedEdges(prev => applyEdgeChanges(filtered, prev));
    }
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;

    const floatingNode = floatingNodes.find(n => n.id === connection.target);
    if (floatingNode) {
      const nodeData = floatingNode.data as { nodeType: string; config: GraphNode['config'] };
      const graphNode: GraphNode = {
        id: connection.target,
        type: nodeData.nodeType as NodeType,
        config: nodeData.config,
        parentId: connection.source,
      };
      setCodeWithHistory(prev => addNodeToDsl(prev, graphNode));
      setFloatingNodes(prev => prev.filter(n => n.id !== connection.target));
      return;
    }

    const registry = evaluateDsl(code);
    const targetNode = registry.nodes.find(n => n.id === connection.target);
    if (targetNode?.type === 'join' && targetNode.parentId !== connection.source) {
      updateConfig(connection.target, 'nodeId', JSON.stringify(connection.source));
    }
  }, [floatingNodes, code, updateConfig]);

  const addNode = useCallback((type: NodeType, id: string, parentId?: string, position?: { x: number; y: number }) => {
    if (type === 'source' || parentId) {
      addNodeToCode(type, id, parentId);
      setFloatingNodes(prev => prev.filter(n => n.id !== id));
    } else {
      const pos = position ?? { x: 100, y: 100 };
      setFloatingNodes(prev => [
        ...prev,
        {
          id,
          type,
          position: pos,
          data: { label: id, nodeType: type, config: defaultConfigs[type], unlinked: true },
        },
      ]);
    }
  }, [addNodeToCode]);

  const handleRun = useCallback(async () => {
    const registry = evaluateDsl(code);
    if (registry.error) return;
    setIsRunning(true);
    setResults(new Map());
    try {
      const execResults = await executePipeline(registry, (nodeId, result) => {
        setResults(prev => new Map(prev).set(nodeId, result));
      });
      setResults(execResults);
    } catch (e) {
      console.error('Pipeline execution failed:', e);
    } finally {
      setIsRunning(false);
    }
  }, [code]);

  const handleAutoLayout = useCallback(() => {
    try {
      const registry = evaluateDsl(code);
      const { nodes: layoutNodes } = registryToFlow(registry, updateConfig);
      setNodes(prev => {
        const prevMap = new Map(prev.map(n => [n.id, n]));
        const merged = layoutNodes.map(n => {
          const existing = prevMap.get(n.id);
          if (existing) {
            return { ...n, selected: existing.selected, data: { ...n.data, result: (existing.data as Record<string, unknown>).result } };
          }
          return n;
        });
        const layoutIds = new Set(layoutNodes.map(n => n.id));
        return [...merged, ...floatingNodes.filter(n => !layoutIds.has(n.id))];
      });
    } catch { /* ignore */ }
  }, [code, updateConfig, floatingNodes]);

  const handleClear = useCallback(() => {
    setCodeWithHistory('');
    setResults(new Map());
    selectNode(null);
    setFloatingNodes([]);
  }, [setCodeWithHistory, selectNode]);

  const handleExampleSelect = useCallback((exampleCode: string) => {
    setCodeWithHistory(exampleCode);
    setResults(new Map());
    selectNode(null);
    setFloatingNodes([]);
  }, [setCodeWithHistory, selectNode]);

  const [panelWidth, setPanelWidth] = useState(480);
  const dragging = useRef(false);

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const newWidth = window.innerWidth - ev.clientX;
      setPanelWidth(Math.max(200, Math.min(newWidth, window.innerWidth - 300)));
    };
    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  const nodeCount = nodes.length;
  const errorCount = Array.from(results.values()).filter(r => r.status === 'error').length;
  const totalTime = Array.from(results.values()).reduce((sum, r) => sum + (r.durationMs ?? 0), 0);

  const lastValidPanel = useRef<{ nodeType?: NodeType; nodeConfig?: GraphNode['config']; nodeIds: string[] }>({ nodeIds: [] });

  let selectedNodeType: NodeType | undefined;
  let selectedNodeConfig: GraphNode['config'] | undefined;
  let registryNodeIds: string[] = [];
  const registry = evaluateDsl(code);
  registryNodeIds = registry.nodes.map(n => n.id);
  if (selectedNodeId) {
    const found = registry.nodes.find(n => n.id === selectedNodeId);
    if (found) {
      selectedNodeType = found.type;
      selectedNodeConfig = found.config;
    }
  }
  if (!registry.error) {
    lastValidPanel.current = { nodeType: selectedNodeType, nodeConfig: selectedNodeConfig, nodeIds: registryNodeIds };
  } else if (selectedNodeId) {
    selectedNodeType = selectedNodeType ?? lastValidPanel.current.nodeType;
    selectedNodeConfig = selectedNodeConfig ?? lastValidPanel.current.nodeConfig;
    registryNodeIds = lastValidPanel.current.nodeIds.length > 0 ? lastValidPanel.current.nodeIds : registryNodeIds;
  }

  const handleConfigChange = useCallback((key: string, value: string) => {
    if (selectedNodeId) updateConfig(selectedNodeId, key, value);
  }, [selectedNodeId, updateConfig]);

  return (
    <div className={styles.layout}>
      <Toolbar
        onRun={handleRun}
        onAutoLayout={handleAutoLayout}
        onClear={handleClear}
        onExampleSelect={handleExampleSelect}
        isRunning={isRunning}
      />
      <div className={styles.main}>
        <div className={styles.graphArea}>
          <NodeMenu />
          <GraphCanvas
            nodes={nodes}
            edges={managedEdges}
            selectedNodeId={selectedNodeId}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeSelect={selectNode}
            addNode={addNode}
          />
        </div>
        <div className={styles.divider} onMouseDown={onDividerMouseDown} />
        <div className={styles.panel} style={{ width: panelWidth, flex: 'none' }}>
          <RightPanel
            code={code}
            onCodeChange={setCode}
            selectedNodeId={selectedNodeId}
            onNodeSelect={selectNode}
            onNodeHighlight={setHighlightedNodeId}
            results={results}
            error={error}
            selectedNodeType={selectedNodeType}
            selectedNodeConfig={selectedNodeConfig}
            onConfigChange={handleConfigChange}
            nodeIds={registryNodeIds}
          />
        </div>
      </div>
      <div className={styles.statusBar}>
        <span>{nodeCount} nodes</span>
        {error && <span className={styles.statusError}>{error}</span>}
        {results.size > 0 && (
          <>
            <span>·</span>
            <span>{Math.round(totalTime)}ms total</span>
            {errorCount > 0 && <span className={styles.statusError}>· {errorCount} errors</span>}
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ReactFlowProvider>
        <DndProvider>
          <AppInner />
        </DndProvider>
      </ReactFlowProvider>
    </ErrorBoundary>
  );
}
