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
import { useKeyboardHandler } from './graph/useKeyboardHandler';
import { evaluateDsl } from './dsl/runtime';
import { executePipeline, findConnectedNodes, executeTransform, topologicalSort } from './dsl/execute';
import { removeNodeFromCode, renameNodeInCode } from './dsl/codegen';
import { AppProvider } from './state/AppProvider';
import { useAppState, useAppDispatch } from './state/useAppState';
import { ErrorBoundary } from './ErrorBoundary';
import type { NodeType, GraphNode, GraphEdge } from './types';
import styles from './App.module.css';

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

  useKeyboardHandler(state, { dispatch, setCodeWithHistory, updateConfig });

  const prevCodeRef = useRef(state.code);
  const resultsRef = useRef(state.results);
  resultsRef.current = state.results;

  useEffect(() => {
    if (prevCodeRef.current === state.code) {
      prevCodeRef.current = state.code;
      return;
    }
    prevCodeRef.current = state.code;

    const currentResults = resultsRef.current;
    if (currentResults.size === 0 || state.isRunning) return;

    const reg = evaluateDsl(state.code);
    if (reg.error || reg.nodes.length === 0) return;

    const nodeMap = new Map(reg.nodes.map(n => [n.id, n]));
    const order = topologicalSort(reg);
    const liveResults = new Map(currentResults);
    let changed = false;

    for (const id of order) {
      const node = nodeMap.get(id)!;
      if (node.type === 'source') continue;

      const parentData = liveResults.get(node.parentId!)?.data;
      if (!parentData) continue;

      try {
        const data = executeTransform(node, parentData, liveResults);
        liveResults.set(id, { nodeId: id, status: 'success', data, durationMs: 0, preview: true });
        changed = true;
      } catch (err) {
        liveResults.set(id, { nodeId: id, status: 'error', error: err instanceof Error ? err.message : String(err), preview: true });
        changed = true;
      }
    }

    if (changed) dispatch({ type: 'RUN_COMPLETE', results: liveResults });
  }, [state.code, state.isRunning, dispatch]);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

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

    const registry = evaluateDsl(s.code);
    const targetNode = registry.nodes.find(n => n.id === connection.target);
    if (!targetNode || targetNode.type === 'source') return;

    if (!targetNode.parentId) {
      updateConfig(connection.target, '__parent', JSON.stringify(connection.source));
    } else if (targetNode.type === 'join') {
      updateConfig(connection.target, 'nodeId', JSON.stringify(connection.source));
    }
  }, [updateConfig]);

  const addNode = useCallback((type: NodeType, id: string, parentId?: string, position?: { x: number; y: number }) => {
    if (position) dispatch({ type: 'SET_PENDING_POSITION', id, position });
    addNodeToCode(type, id, parentId);
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
      dispatch({ type: 'APPLY_NODE_CHANGES', changes: withFloating.map(n => ({ type: 'replace' as const, id: n.id, item: n })) });
    } catch { /* ignore */ }
  }, [updateConfig, dispatch]);

  const handleClear = useCallback(
    () => dispatch({ type: 'CLEAR' }),
    [dispatch],
  );

  const handleRemoveOrphans = useCallback(() => {
    const reg = evaluateDsl(state.code);
    if (reg.error) return;
    const connected = findConnectedNodes(reg);
    const orphanIds = reg.nodes.filter(n => !connected.has(n.id)).map(n => n.id);
    if (orphanIds.length === 0) return;
    setCodeWithHistory(prev => {
      let result = prev;
      for (const id of orphanIds) {
        result = removeNodeFromCode(result, id);
      }
      return result;
    });
  }, [state.code, setCodeWithHistory]);

  const hasOrphans = useMemo(() => {
    const reg = evaluateDsl(state.code);
    if (reg.error || reg.nodes.length === 0) return false;
    const connected = findConnectedNodes(reg);
    return reg.nodes.some(n => !connected.has(n.id));
  }, [state.code]);

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
  let selectedParentId: string | undefined;
  let registryNodeIds: string[] = [];
  let registryEdges: GraphEdge[] = [];
  const registry = evaluateDsl(state.code);
  registryNodeIds = registry.nodes.map(n => n.id);
  registryEdges = registry.edges;
  if (state.selectedNodeId) {
    const found = registry.nodes.find(n => n.id === state.selectedNodeId);
    if (found) {
      selectedNodeType = found.type;
      selectedNodeConfig = found.config;
      selectedParentId = found.parentId;
    }
  }

  const parentFields: string[] = (() => {
    if (!selectedParentId) return [];
    const parentResult = state.results.get(selectedParentId);
    const firstItem = parentResult?.data?.items?.[0];
    if (!firstItem || typeof firstItem !== 'object') return [];
    const paths: string[] = [];
    const walk = (obj: Record<string, unknown>, prefix: string) => {
      for (const key of Object.keys(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        paths.push(path);
        const val = obj[key];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          walk(val as Record<string, unknown>, path);
        }
      }
    };
    walk(firstItem as Record<string, unknown>, '');
    return paths;
  })();
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

  const handleNodeRename = useCallback((oldId: string, newId: string) => {
    setCodeWithHistory(prev => renameNodeInCode(prev, oldId, newId));
    dispatch({ type: 'SELECT_NODE', id: newId });
  }, [setCodeWithHistory, dispatch]);

  return (
    <div className={styles.layout}>
      <Toolbar
        onRun={handleRun}
        onAutoLayout={handleAutoLayout}
        onClear={handleClear}
        onRemoveOrphans={handleRemoveOrphans}
        onExampleSelect={handleExampleSelect}
        isRunning={state.isRunning}
        hasOrphans={hasOrphans}
        showHint={state.code === '' && state.nodes.length === 0}
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
            onNodeRename={handleNodeRename}
            nodeIds={registryNodeIds}
            registryEdges={registryEdges}
            parentFields={parentFields}
            selectedParentId={selectedParentId}
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
