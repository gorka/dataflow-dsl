import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { ResultLine } from '../../shared/ResultLine';
import type { NodeType, FilterConfig, MapConfig, SelectConfig, JoinConfig, ExecutionResult } from '../../types';
import styles from './TransformNode.module.css';

export interface TransformNodeData {
  label: string;
  nodeType: NodeType;
  config: FilterConfig | MapConfig | SelectConfig | JoinConfig;
  result?: ExecutionResult;
  unlinked?: boolean;
  onConfigChange?: (key: string, value: string) => void;
  nodeIds?: string[];
  role?: 'input' | 'output';
  connected?: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  filter: '#43b581',
  map: '#faa61a',
  select: '#9b59b6',
  join: '#f04747',
};

export function TransformNode(props: NodeProps) {
  const { label, nodeType, result, unlinked, role, connected } = props.data as unknown as TransformNodeData;
  const color = TYPE_COLORS[nodeType] ?? '#5865f2';

  return (
    <div className={styles.wrapper}>
      {role === 'input' && <div className={styles.arrowAbove}>▼</div>}
      <div className={`${styles.node} ${role ? styles[role] : ''}`} style={{ borderColor: unlinked || connected === false ? '#666' : color, opacity: unlinked || connected === false || result?.status === 'skipped' ? 0.45 : 1 }}>
        <Handle type="target" position={Position.Top} className={styles.handle} style={{ background: color }} />
        <div className={styles.header} style={{ background: unlinked || connected === false ? '#444' : color }}>
          <span className={styles.label}>{label}</span>
          <span className={styles.badge}>{nodeType.toUpperCase()}</span>
        </div>
        {unlinked && <div className={`${styles.result} ${styles.error}`}>unlinked</div>}
        <ResultLine
          result={result}
          className={styles.result}
          successClass={styles.success}
          errorClass={styles.error}
          runningClass={styles.running}
          skippedClass={styles.skipped}
        />
        <Handle type="source" position={Position.Bottom} className={styles.handle} style={{ background: color }} />
      </div>
      {role === 'output' && <div className={styles.arrowBelow}>▼</div>}
    </div>
  );
}
