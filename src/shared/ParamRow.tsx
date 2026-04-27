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

  const [refNode, setRefNode] = useState(startAsRef ? (value as RefValue).nodeId : '');
  const [refField, setRefField] = useState(startAsRef ? (value as RefValue).field : '');

  useEffect(() => {
    if (isRefValue(value)) {
      setMode('ref');
      setRefNode(value.nodeId);
      setRefField(value.field);
    } else {
      setMode('val');
    }
  }, [value]);

  const valDisplay = startAsRef ? '' : String(value ?? '');

  const serializeRef = (node: string, field: string) =>
    `ref(${JSON.stringify(node)}, ${JSON.stringify(field)})`;

  const toggleMode = () => {
    const next = mode === 'val' ? 'ref' : 'val';
    setMode(next);
    if (next === 'val') {
      onCommit('""');
    } else {
      onCommit(serializeRef(refNode, refField));
    }
  };

  const handleNodeSelect = (nodeId: string) => {
    setRefNode(nodeId);
    onCommit(serializeRef(nodeId, refField));
  };

  const handleFieldChange = (field: string) => {
    setRefField(field);
    onCommit(serializeRef(refNode, field));
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
          value={valDisplay}
          placeholder="value"
          onChange={e => onCommit(serializeLiteral(e.target.value))}
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
            onChange={e => handleFieldChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
