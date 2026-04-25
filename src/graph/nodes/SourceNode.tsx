import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { ResultLine } from '../../shared/ResultLine';
import type { SourceConfig, ExecutionResult } from '../../types';
import styles from './SourceNode.module.css';

export interface SourceNodeData {
  label: string;
  config: SourceConfig;
  result?: ExecutionResult;
  onConfigChange?: (key: string, value: string) => void;
  nodeIds?: string[];
  role?: 'input' | 'output';
  connected?: boolean;
}

export function SourceNode(props: NodeProps) {
  const { label, result, role, connected } = props.data as unknown as SourceNodeData;

  return (
    <div className={styles.wrapper}>
      {role === 'input' && <div className={styles.arrowAbove}>▼</div>}
      <div className={`${styles.node} ${role ? styles[role] : ''}`} style={{ borderColor: connected === false ? '#666' : '#5865f2', opacity: connected === false || result?.status === 'skipped' ? 0.45 : 1 }}>
        <Handle type="target" position={Position.Top} className={styles.handle} style={{ background: '#5865f2' }} />
        <div className={styles.header} style={{ background: connected === false ? '#444' : '#5865f2' }}>
          <span className={styles.label}>{label}</span>
          <span className={styles.badge}>SOURCE</span>
        </div>
        <ResultLine
          result={result}
          className={styles.result}
          successClass={styles.success}
          errorClass={styles.error}
          runningClass={styles.running}
          skippedClass={styles.skipped}
        />
        <Handle type="source" position={Position.Bottom} className={styles.handle} style={{ background: '#5865f2' }} />
      </div>
      {role === 'output' && <div className={styles.arrowBelow}>▼</div>}
    </div>
  );
}
