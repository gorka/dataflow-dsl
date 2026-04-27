import { useState } from 'react';
import type { SourceConfig } from '../types';
import { ParamRow, extractPlaceholders, serializeParamValue } from './ParamRow';

export function ParamRows({ endpoint, config, nodeIds, currentNodeId, onConfigChange, styles }: {
  endpoint: string;
  config: SourceConfig;
  nodeIds: string[];
  currentNodeId?: string;
  onConfigChange?: (key: string, value: string) => void;
  styles: Record<string, string>;
}) {
  const [newKey, setNewKey] = useState('');
  const [error, setError] = useState('');
  const placeholders = extractPlaceholders(endpoint);
  const params = config.params ?? {};
  const allKeys = [...new Set([...placeholders, ...Object.keys(params)])];

  const handleCommit = (paramKey: string, serialized: string) => {
    const entries = allKeys.map(k => {
      if (k === paramKey) return `${k}: ${serialized}`;
      return `${k}: ${serializeParamValue(params[k])}`;
    });
    onConfigChange?.('params', `{ ${entries.join(', ')} }`);
  };

  const handleAddParam = () => {
    const key = newKey.trim();
    if (!key) { setError('enter a param name'); return; }
    if (allKeys.includes(key)) { setError(`"${key}" already exists`); return; }
    const entries = [
      ...allKeys.map(k => `${k}: ${serializeParamValue(params[k])}`),
      `${key}: ""`,
    ];
    onConfigChange?.('params', `{ ${entries.join(', ')} }`);
    setNewKey('');
  };

  if (allKeys.length === 0 && !onConfigChange) return null;

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>params</span>
      {allKeys.map(k => (
        <ParamRow
          key={k}
          paramKey={k}
          value={params[k]}
          nodeIds={currentNodeId ? nodeIds.filter(id => id !== currentNodeId) : nodeIds}
          onCommit={serialized => handleCommit(k, serialized)}
          styles={styles}
        />
      ))}
      {onConfigChange && (
        <div className={styles.paramRow}>
          <input
            className={`${styles.fieldInput} ${error ? styles.fieldInputError : ''}`}
            value={newKey}
            placeholder="new param name"
            onChange={e => { setNewKey(e.target.value); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleAddParam(); }}
          />
          <button
            type="button"
            className={styles.modeToggle}
            onClick={handleAddParam}
          >
            +
          </button>
          {error && <span className={styles.errorText}>{error}</span>}
        </div>
      )}
    </div>
  );
}
