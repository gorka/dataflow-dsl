import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type { NodeChange, EdgeChange, Connection } from '@xyflow/react';
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
import { AppProvider } from './state/AppProvider';
import { useAppState, useAppDispatch } from './state/useAppState';
import { ErrorBoundary } from './ErrorBoundary';
import type { NodeType, GraphNode } from './types';
import styles from './App.module.css';

const defaultConfigs: Record<string, GraphNode['config']> = {
  filter: { expression: '' },
  map: { mapping: {} },
  select: { fields: [] },
  join: { nodeId: '', as: '' },
};

function AppInner() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  const setCodeWithHistory = useCallback(
    (code: string | ((prev: string) => string)) => {
      dispatch({ type: 'SET_CODE_WITH_HISTORY', code });
    },
    [dispatch],
  );

  const { addNode: addNodeToCode, updateConfig } = useDslFromGraph(state.code, setCodeWithHistory);
  const { nodes: dslNodes, edges, error } = useGraphFromDsl(state.code, updateConfig);

  useEffect(() => {
    dispatch({ type: 'MERGE_DSL_NODES', dslNodes });
  }, [dslNodes, dispatch]);

  useEffect(() => {
    dispatch({ type: 'SET_EDGES', edges });
  }, [edges, dispatch]);

  useEffect(() => {
    dispatch({ type: 'UPDATE_NODE_RESULTS', results: state.results });
  }, [state.results, dispatch]);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active?.closest('.cm-editor') || active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.tagName === 'SELECT') return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const s = stateRef.current;
        const selectedEdge = s.edges.find(edge => {
          const el = document.querySelector(`[aria-label="Edge from ${edge.source} to ${edge.target}"]`);
          return el?.closest('.selected') != null;
        });

        if (selectedEdge) {
          e.preventDefault();
          const edgeType = (selectedEdge.data as { edgeType: string } | undefined)?.edgeType;
          if (edgeType === 'chain') {
            const registry = evaluateDsl(s.code);
            const targetNode = registry.nodes.find(n => n.id === selectedEdge.target);
            if (!targetNode) return;
            setCodeWithHistory(prev => removeNodeFromCode(prev, selectedEdge.target));
            const currentNode = s.nodes.find(n => n.id === selectedEdge.target);
            const position = currentNode?.position ?? { x: 100, y: 100 };
            dispatch({
              type: 'ADD_FLOATING_NODE',
              node: { id: targetNode.id, type: targetNode.type, position, data: { label: targetNode.id, nodeType: targetNode.type, config: targetNode.config, unlinked: true } },
            });
          } else if (edgeType === 'join') {
            updateConfig(selectedEdge.target, 'nodeId', '""');
          }
          return;
        }

        const selectedNode = s.nodes.find(n => n.selected);
        if (selectedNode) {
          e.preventDefault();
          const isFloating = s.floatingNodes.some(n => n.id === selectedNode.id);
          if (isFloating) {
            dispatch({ type: 'REMOVE_FLOATING_NODE', id: selectedNode.id });
          } else {
            setCodeWithHistory(prev => removeNodeFromCode(prev, selectedNode.id));
          }
          if (s.selectedNodeId === selectedNode.id) {
            dispatch({ type: 'SELECT_NODE', id: null });
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch, setCodeWithHistory, updateConfig]);

  const selectNode = useCallback(
    (id: string | null) => dispatch({ type: 'SELECT_NODE', id }),
    [dispatch],
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const filtered = changes.filter(c => c.type !== 'remove');
    dispatch({ type: 'APPLY_NODE_CHANGES', changes: filtered });
  }, [dispatch]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const filtered = changes.filter(c => c.type !== 'remove');
    if (filtered.length > 0) dispatch({ type: 'APPLY_EDGE_CHANGES', changes: filtered });
  }, [dispatch]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const s = stateRef.current;

    const floatingNode = s.floatingNodes.find(n => n.id === connection.target);
    if (floatingNode) {
      const nodeData = floatingNode.data as { nodeType: string; config: GraphNode['config'] };
      const graphNode: GraphNode = {
        id: connection.target,
        type: nodeData.nodeType as NodeType,
        config: nodeData.config,
        parentId: connection.source,
      };
      setCodeWithHistory(prev => addNodeToDsl(prev, graphNode));
      dispatch({ type: 'REMOVE_FLOATING_NODE', id: connection.target! });
      return;
    }

    const registry = evaluateDsl(s.code);
    const targetNode = registry.nodes.find(n => n.id === connection.target);
    if (targetNode?.type === 'join' && targetNode.parentId !== connection.source) {
      updateConfig(connection.target, 'nodeId', JSON.stringify(connection.source));
    }
  }, [setCodeWithHistory, updateConfig, dispatch]);

  const addNode = useCallback((type: NodeType, id: string, parentId?: string, position?: { x: number; y: number }) => {
    if (type === 'source' || parentId) {
      addNodeToCode(type, id, parentId);
      dispatch({ type: 'REMOVE_FLOATING_NODE', id });
    } else {
      const pos = position ?? { x: 100, y: 100 };
      dispatch({
        type: 'ADD_FLOATING_NODE',
        node: { id, type, position: pos, data: { label: id, nodeType: type, config: defaultConfigs[type], unlinked: true } },
      });
    }
  }, [addNodeToCode, dispatch]);

  const handleRun = useCallback(async () => {
    const registry = evaluateDsl(state.code);
    if (registry.error) return;
    dispatch({ type: 'RUN_START' });
    try {
      const execResults = await executePipeline(registry, (nodeId, result) => {
        dispatch({ type: 'NODE_RESULT', nodeId, result });
      });
      dispatch({ type: 'RUN_COMPLETE', results: execResults });
    } catch (e) {
      console.error('Pipeline execution failed:', e);
      dispatch({ type: 'RUN_COMPLETE', results: new Map() });
    }
  }, [state.code, dispatch]);

  const handleAutoLayout = useCallback(() => {
    try {
      const s = stateRef.current;
      const registry = evaluateDsl(s.code);
      const { nodes: layoutNodes } = registryToFlow(registry, updateConfig);
      const prevMap = new Map(s.nodes.map(n => [n.id, n]));
      const merged = layoutNodes.map(n => {
        const existing = prevMap.get(n.id);
        if (existing) {
          return { ...n, selected: existing.selected, data: { ...n.data, result: (existing.data as Record<string, unknown>).result } };
        }
        return n;
      });
      const layoutIds = new Set(layoutNodes.map(n => n.id));
      const withFloating = [...merged, ...s.floatingNodes.filter(n => !layoutIds.has(n.id))];
      dispatch({ type: 'APPLY_NODE_CHANGES', changes: withFloating.map(n => ({ type: 'reset' as const, item: n })) });
    } catch { /* ignore */ }
  }, [updateConfig, dispatch]);

  const handleClear = useCallback(
    () => dispatch({ type: 'CLEAR' }),
    [dispatch],
  );

  const handleExampleSelect = useCallback(
    (exampleCode: string) => dispatch({ type: 'LOAD_EXAMPLE', code: exampleCode }),
    [dispatch],
  );

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

  const nodeCount = state.nodes.length;
  const errorCount = useMemo(
    () => Array.from(state.results.values()).filter(r => r.status === 'error').length,
    [state.results],
  );
  const totalTime = useMemo(
    () => Array.from(state.results.values()).reduce((sum, r) => sum + (r.durationMs ?? 0), 0),
    [state.results],
  );

  const lastValidPanel = useRef<{ nodeType?: NodeType; nodeConfig?: GraphNode['config']; nodeIds: string[] }>({ nodeIds: [] });

  let selectedNodeType: NodeType | undefined;
  let selectedNodeConfig: GraphNode['config'] | undefined;
  let registryNodeIds: string[] = [];
  const registry = evaluateDsl(state.code);
  registryNodeIds = registry.nodes.map(n => n.id);
  if (state.selectedNodeId) {
    const found = registry.nodes.find(n => n.id === state.selectedNodeId);
    if (found) {
      selectedNodeType = found.type;
      selectedNodeConfig = found.config;
    }
  }
  if (!registry.error) {
    lastValidPanel.current = { nodeType: selectedNodeType, nodeConfig: selectedNodeConfig, nodeIds: registryNodeIds };
  } else if (state.selectedNodeId) {
    selectedNodeType = selectedNodeType ?? lastValidPanel.current.nodeType;
    selectedNodeConfig = selectedNodeConfig ?? lastValidPanel.current.nodeConfig;
    registryNodeIds = lastValidPanel.current.nodeIds.length > 0 ? lastValidPanel.current.nodeIds : registryNodeIds;
  }

  const handleConfigChange = useCallback((key: string, value: string) => {
    if (state.selectedNodeId) updateConfig(state.selectedNodeId, key, value);
  }, [state.selectedNodeId, updateConfig]);

  return (
    <div className={styles.layout}>
      <Toolbar
        onRun={handleRun}
        onAutoLayout={handleAutoLayout}
        onClear={handleClear}
        onExampleSelect={handleExampleSelect}
        isRunning={state.isRunning}
      />
      <div className={styles.main}>
        <div className={styles.graphArea}>
          <NodeMenu />
          <GraphCanvas
            nodes={state.nodes}
            edges={state.edges}
            selectedNodeId={state.selectedNodeId}
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
            code={state.code}
            onCodeChange={(c: string) => dispatch({ type: 'SET_CODE', code: c })}
            selectedNodeId={state.selectedNodeId}
            onNodeSelect={selectNode}
            onNodeHighlight={(id: string | null) => dispatch({ type: 'HIGHLIGHT_NODE', id })}
            results={state.results}
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
        {state.results.size > 0 && (
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
          <AppProvider>
            <AppInner />
          </AppProvider>
        </DndProvider>
      </ReactFlowProvider>
    </ErrorBoundary>
  );
}
