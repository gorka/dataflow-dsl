import type { ExecutionResult } from '../types';
import styles from './OutputViewer.module.css';

interface OutputViewerProps {
  selectedNodeId: string | null;
  results: Map<string, ExecutionResult>;
}

export function OutputViewer({ selectedNodeId, results }: OutputViewerProps) {
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

  return (
    <div className={styles.output}>
      <div className={styles.header}>
        <span>{selectedNodeId}</span>
        <span className={styles.meta}>
          {result.data?.items.length} items · {Math.round(result.durationMs ?? 0)}ms
        </span>
      </div>
      <pre className={styles.json}>{JSON.stringify(result.data, null, 2)}</pre>
    </div>
  );
}
