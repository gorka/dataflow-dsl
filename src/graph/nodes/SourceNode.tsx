import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { SourceConfig, ExecutionResult, RefValue } from '../../types';
import styles from './SourceNode.module.css';

export interface SourceNodeData {
  label: string;
  config: SourceConfig;
  result?: ExecutionResult;
  onConfigChange?: (key: string, value: string) => void;
}

function isRefValue(val: unknown): val is RefValue {
  return typeof val === 'object' && val !== null && (val as RefValue).__ref === true;
}

function formatEndpoint(endpoint: string | RefValue): string {
  if (isRefValue(endpoint)) return `ref(${endpoint.nodeId}, "${endpoint.field}")`;
  return endpoint;
}

function ResultLine({ result }: { result?: ExecutionResult }) {
  if (!result) return null;
  if (result.status === 'running') return <div className={`${styles.result} ${styles.running}`}>⟳ running...</div>;
  if (result.status === 'error') return <div className={`${styles.result} ${styles.error}`}>✗ {result.error}</div>;
  if (result.status === 'success') {
    const count = result.data?.items.length ?? 0;
    const ms = result.durationMs ?? 0;
    return <div className={`${styles.result} ${styles.success}`}>✓ {count} items · {ms}ms</div>;
  }
  return null;
}

export function SourceNode(props: NodeProps) {
  const { label, config, result, onConfigChange } = props.data as unknown as SourceNodeData;
  const endpointIsRef = isRefValue(config.endpoint);
  const endpointValue = formatEndpoint(config.endpoint);
  const paramsJson = config.params ? JSON.stringify(config.params) : '';

  return (
    <div className={styles.node} style={{ borderColor: '#5865f2' }}>
      <Handle type="target" position={Position.Left} className={styles.handle} style={{ background: '#5865f2' }} />
      <div className={styles.header} style={{ background: '#5865f2' }}>
        <span className={styles.label}>{label}</span>
        <span className={styles.badge}>SOURCE</span>
      </div>
      <div className={styles.body}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>endpoint</span>
          <input
            className={styles.fieldInput}
            value={endpointValue}
            readOnly={endpointIsRef}
            onChange={e => onConfigChange?.('endpoint', e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>method</span>
          <input
            className={styles.fieldInput}
            value={config.method ?? 'GET'}
            onChange={e => onConfigChange?.('method', e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>params</span>
          <input
            className={styles.fieldInput}
            value={paramsJson}
            onChange={e => onConfigChange?.('params', e.target.value)}
          />
        </div>
      </div>
      <ResultLine result={result} />
      <Handle type="source" position={Position.Right} className={styles.handle} style={{ background: '#5865f2' }} />
    </div>
  );
}
