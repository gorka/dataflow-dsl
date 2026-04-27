import { useEffect } from 'react';

import type { SourceConfig } from '../types';
import { BlurInput } from '../shared/BlurInput';
import { ParamRows } from '../shared/ParamRows';
import { extractPlaceholders, serializeParamValue } from '../shared/ParamRow';
import styles from './NodeConfigPanel.module.css';

interface SourceConfigPanelProps {
  config: SourceConfig;
  onConfigChange: (key: string, value: string) => void;
  nodeIds: string[];
  currentNodeId: string;
}

export function SourceConfigPanel({ config, onConfigChange, nodeIds, currentNodeId }: SourceConfigPanelProps) {
  const endpoint = config.endpoint ?? '';

  const paramKeys = config.params ? Object.keys(config.params).sort().join(',') : '';
  useEffect(() => {
    syncParams(endpoint, config, onConfigChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, paramKeys]);

  return (
    <>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>endpoint</span>
        <input
          className={styles.fieldInput}
          value={endpoint}
          onChange={e => onConfigChange('endpoint', JSON.stringify(e.target.value))}
        />
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>method</span>
        <BlurInput
          className={styles.fieldInput}
          value={config.method ?? 'GET'}
          onCommit={v => onConfigChange('method', JSON.stringify(v))}
        />
      </div>
      <ParamRows endpoint={endpoint} config={config} nodeIds={nodeIds} currentNodeId={currentNodeId} onConfigChange={onConfigChange} styles={styles} />
    </>
  );
}

function syncParams(endpoint: string, config: SourceConfig, onConfigChange: (key: string, value: string) => void) {
  const placeholders = extractPlaceholders(endpoint);
  if (placeholders.length === 0) return;
  const existing = config.params ?? {};
  const missing = placeholders.filter(k => !(k in existing));
  if (missing.length === 0) return;
  const allKeys = [...new Set([...Object.keys(existing), ...placeholders])];
  const entries = allKeys.map(k => `${k}: ${serializeParamValue(existing[k])}`);
  onConfigChange('params', `{ ${entries.join(', ')} }`);
}
