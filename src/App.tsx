import { useState, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { DndProvider } from './graph/DndContext';
import { GraphCanvas } from './graph/GraphCanvas';
import { NodeMenu } from './graph/NodeMenu';
import { RightPanel } from './panel/RightPanel';
import { Toolbar } from './toolbar/Toolbar';
import { useGraphFromDsl } from './graph/useGraphFromDsl';
import { useDslFromGraph } from './graph/useDslFromGraph';
import { evaluateDsl } from './dsl/runtime';
import { executePipeline } from './dsl/execute';
import { DEFAULT_PIPELINE } from './dsl/default-pipeline';
import type { ExecutionResult } from './types';
import styles from './App.module.css';

function AppInner() {
  const [code, setCode] = useState(DEFAULT_PIPELINE);
  const [results, setResults] = useState<Map<string, ExecutionResult>>(new Map());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const { nodes, edges, error } = useGraphFromDsl(code, results);
  const { addNode } = useDslFromGraph(code, setCode);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setResults(new Map());
    try {
      const registry = evaluateDsl(code);
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
    setCode(prev => prev + '');
  }, []);

  const handleClear = useCallback(() => {
    setCode('');
    setResults(new Map());
    setSelectedNodeId(null);
  }, []);

  const nodeCount = nodes.length;
  const errorCount = Array.from(results.values()).filter(r => r.status === 'error').length;
  const totalTime = Array.from(results.values()).reduce((sum, r) => sum + (r.durationMs ?? 0), 0);

  return (
    <div className={styles.layout}>
      <Toolbar
        onRun={handleRun}
        onAutoLayout={handleAutoLayout}
        onClear={handleClear}
        isRunning={isRunning}
      />
      <div className={styles.main}>
        <div className={styles.graphArea}>
          <NodeMenu />
          <GraphCanvas
            nodes={nodes}
            edges={edges}
            onNodeSelect={setSelectedNodeId}
            addNode={addNode}
          />
        </div>
        <div className={styles.panel}>
          <RightPanel
            code={code}
            onCodeChange={setCode}
            selectedNodeId={selectedNodeId}
            results={results}
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
    <ReactFlowProvider>
      <DndProvider>
        <AppInner />
      </DndProvider>
    </ReactFlowProvider>
  );
}
