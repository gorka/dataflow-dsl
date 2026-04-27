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
  const existing = config.params ?? {};
  const placeholderSet = new Set(placeholders);

  const stale = Object.keys(existing).filter(k =>
    !placeholderSet.has(k) && (existing[k] === '' || existing[k] === undefined)
  );
  const missing = placeholders.filter(k => !(k in existing));

  if (missing.length === 0 && stale.length === 0) return;

  const staleSet = new Set(stale);
  const kept = Object.keys(existing).filter(k => !staleSet.has(k));
  const allKeys = [...new Set([...kept, ...placeholders])];

  if (allKeys.length === 0) {
    onConfigChange('params', '{}');
    return;
  }
  const entries = allKeys.map(k => `${k}: ${serializeParamValue(existing[k])}`);
  onConfigChange('params', `{ ${entries.join(', ')} }`);
}
