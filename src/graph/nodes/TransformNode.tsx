import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { NodeType, FilterConfig, MapConfig, SelectConfig, JoinConfig, ExecutionResult } from '../../types';
import styles from './TransformNode.module.css';

export interface TransformNodeData {
  label: string;
  nodeType: NodeType;
  config: FilterConfig | MapConfig | SelectConfig | JoinConfig;
  result?: ExecutionResult;
  onConfigChange?: (key: string, value: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  filter: '#43b581',
  map: '#faa61a',
  select: '#5865f2',
  join: '#f04747',
};

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

function ConfigDisplay({ nodeType, config, onConfigChange }: {
  nodeType: NodeType;
  config: FilterConfig | MapConfig | SelectConfig | JoinConfig;
  onConfigChange?: (key: string, value: string) => void;
}) {
  if (nodeType === 'filter') {
    const fc = config as FilterConfig;
    return (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>expression</span>
        <input
          className={styles.fieldInput}
          value={fc.expression}
          onChange={e => onConfigChange?.('expression', e.target.value)}
        />
      </div>
    );
  }

  if (nodeType === 'map') {
    const mc = config as MapConfig;
    return (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>mapping</span>
        <span className={styles.fieldValue}>{JSON.stringify(mc.mapping)}</span>
      </div>
    );
  }

  if (nodeType === 'select') {
    const sc = config as SelectConfig;
    return (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>fields</span>
        <span className={styles.fieldValue}>{sc.fields.join(', ')}</span>
      </div>
    );
  }

  if (nodeType === 'join') {
    const jc = config as JoinConfig;
    const joinDetail = jc.as ? `as ${jc.as}` : jc.on ? `on ${jc.on[0]}, ${jc.on[1]}` : '';
    return (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>join</span>
        <span className={styles.fieldValue}>{joinDetail}</span>
      </div>
    );
  }

  return null;
}

export function TransformNode(props: NodeProps) {
  const { label, nodeType, config, result, onConfigChange } = props.data as unknown as TransformNodeData;
  const color = TYPE_COLORS[nodeType] ?? '#5865f2';

  return (
    <div className={styles.node} style={{ borderColor: color }}>
      <Handle type="target" position={Position.Left} className={styles.handle} style={{ background: color }} />
      <div className={styles.header} style={{ background: color }}>
        <span className={styles.label}>{label}</span>
        <span className={styles.badge}>{nodeType.toUpperCase()}</span>
      </div>
      <div className={styles.body}>
        <ConfigDisplay nodeType={nodeType} config={config} onConfigChange={onConfigChange} />
      </div>
      <ResultLine result={result} />
      <Handle type="source" position={Position.Right} className={styles.handle} style={{ background: color }} />
    </div>
  );
}
