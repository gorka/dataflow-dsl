import { useState, useEffect } from 'react';
import type { RefValue } from '../types';

export function isRefValue(val: unknown): val is RefValue {
  return typeof val === 'object' && val !== null && (val as RefValue).__ref === true;
}

export function serializeParamValue(v: unknown): string {
  if (isRefValue(v)) return `ref(${JSON.stringify(v.nodeId)}, ${JSON.stringify(v.field)})`;
  if (typeof v === 'string') return JSON.stringify(v);
  return String(v ?? '""');
}

export function serializeLiteral(v: string): string {
  if (v === '') return '""';
  const num = Number(v);
  if (!isNaN(num) && v.trim() !== '') return v;
  return JSON.stringify(v);
}

export function extractPlaceholders(endpoint: string): string[] {
  const matches = endpoint.matchAll(/\{(\w+)\}/g);
  return [...matches].map(m => m[1]);
}

export function ParamRow({ paramKey, value, nodeIds, onCommit, styles }: {
  paramKey: string;
  value: unknown;
  nodeIds: string[];
  onCommit: (serialized: string) => void;
  styles: Record<string, string>;
}) {
  const startAsRef = isRefValue(value);
  const [mode, setMode] = useState<'val' | 'ref'>(startAsRef ? 'ref' : 'val');

  const [localVal, setLocalVal] = useState(startAsRef ? '' : String(value ?? ''));
  const [refNode, setRefNode] = useState(startAsRef ? (value as RefValue).nodeId : '');
  const [refField, setRefField] = useState(startAsRef ? (value as RefValue).field : '');

  useEffect(() => {
    if (isRefValue(value)) {
      setMode('ref');
      setRefNode(value.nodeId);
      setRefField(value.field);
    } else {
      setMode('val');
      setLocalVal(String(value ?? ''));
    }
  }, [value]);

  const commitVal = () => onCommit(serializeLiteral(localVal));
  const commitRef = () => {
    if (refNode && refField) {
      onCommit(`ref(${JSON.stringify(refNode)}, ${JSON.stringify(refField)})`);
    }
  };
  const blur = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  };

  const toggleMode = () => setMode(m => m === 'val' ? 'ref' : 'val');

  const handleNodeSelect = (nodeId: string) => {
    setRefNode(nodeId);
    if (nodeId && refField) {
      onCommit(`ref(${JSON.stringify(nodeId)}, ${JSON.stringify(refField)})`);
    }
  };

  return (
    <div className={styles.paramRow}>
      <span className={styles.paramKey}>{paramKey}</span>
      <button
        type="button"
        className={`${styles.modeToggle} ${mode === 'ref' ? styles.modeRef : ''}`}
        onClick={toggleMode}
      >
        {mode}
      </button>
      {mode === 'val' ? (
        <input
          className={styles.fieldInput}
          value={localVal}
          placeholder="value"
          onChange={e => setLocalVal(e.target.value)}
          onBlur={commitVal}
          onKeyDown={blur}
        />
      ) : (
        <div className={styles.refInputs}>
          <select
            className={styles.refSelect}
            value={refNode}
            onChange={e => handleNodeSelect(e.target.value)}
          >
            <option value="">node...</option>
            {nodeIds.map(id => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
          <input
            className={styles.refInput}
            value={refField}
            placeholder="field"
            onChange={e => setRefField(e.target.value)}
            onBlur={commitRef}
            onKeyDown={blur}
          />
        </div>
      )}
    </div>
  );
}
