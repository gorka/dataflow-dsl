import { useState } from 'react';
import { evaluateDsl } from '../dsl/runtime';
import type { ExecutionResult } from '../types';
import styles from './OutputViewer.module.css';

type ViewMode = 'output' | 'response';

interface OutputViewerProps {
  selectedNodeId: string | null;
  results: Map<string, ExecutionResult>;
  code: string;
}

export function OutputViewer({ selectedNodeId, results, code }: OutputViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('output');

  if (!selectedNodeId) {
    return <div className={styles.empty}>Select a node to view its output</div>;
  }

  const result = results.get(selectedNodeId);

  if (!result) {
    return <div className={styles.empty}>No results yet. Click Run to execute the pipeline.</div>;
  }

  if (result.status === 'error') {
    return (
      <div className={styles.error}>
        <div className={styles.errorTitle}>Error in "{selectedNodeId}"</div>
        <pre className={styles.errorMessage}>{result.error}</pre>
      </div>
    );
  }

  if (result.status === 'running') {
    return <div className={styles.empty}>Running...</div>;
  }

  let isSource = false;
  try {
    const registry = evaluateDsl(code);
    isSource = registry.nodes.find(n => n.id === selectedNodeId)?.type === 'source';
  } catch { /* ignore */ }

  const hasRawResponse = result.rawResponse !== undefined;
  const showToggle = isSource && hasRawResponse;
  const activeMode = showToggle ? viewMode : 'output';

  const displayData = activeMode === 'response'
    ? result.rawResponse
    : result.data?.items;

  const itemCount = result.data?.items.length ?? 0;

  return (
    <div className={styles.output}>
      <div className={styles.header}>
        <span>{selectedNodeId}</span>
        <span className={styles.meta}>
          {itemCount} items · {Math.round(result.durationMs ?? 0)}ms
        </span>
      </div>
      {showToggle && (
        <div className={styles.toggleBar}>
          <button
            className={`${styles.toggleBtn} ${activeMode === 'output' ? styles.activeToggle : ''}`}
            onClick={() => setViewMode('output')}
          >
            Output
          </button>
          <button
            className={`${styles.toggleBtn} ${activeMode === 'response' ? styles.activeToggle : ''}`}
            onClick={() => setViewMode('response')}
          >
            Response
          </button>
        </div>
      )}
      <pre className={styles.json}>{JSON.stringify(displayData, null, 2)}</pre>
    </div>
  );
}
