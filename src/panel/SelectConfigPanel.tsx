import { useState } from 'react';
import type { SelectConfig } from '../types';
import styles from './NodeConfigPanel.module.css';

interface SelectConfigPanelProps {
  config: SelectConfig;
  onConfigChange: (key: string, value: string) => void;
  parentFields: string[];
}

function getSuggestions(parentFields: string[], input: string): string[] {
  const prefix = input.includes('.') ? input.slice(0, input.lastIndexOf('.') + 1) : '';
  const partial = input.slice(prefix.length);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const path of parentFields) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length);
    const segment = rest.split('.')[0];
    if (!segment || seen.has(segment)) continue;
    if (partial && !segment.startsWith(partial)) continue;
    seen.add(segment);
    result.push(segment);
  }
  return result;
}

function hasChildren(parentFields: string[], path: string): boolean {
  const prefix = path + '.';
  return parentFields.some(p => p.startsWith(prefix));
}

function FieldSuggestions({ parentFields, value, onSelect, onDrillDown }: {
  parentFields: string[];
  value: string;
  onSelect: (path: string) => void;
  onDrillDown: (prefix: string) => void;
}) {
  if (parentFields.length === 0) return null;
  const suggestions = getSuggestions(parentFields, value);
  if (suggestions.length === 0) return null;

  const prefix = value.includes('.') ? value.slice(0, value.lastIndexOf('.') + 1) : '';

  return (
    <div className={styles.suggestions}>
      {suggestions.map(s => {
        const fullPath = prefix + s;
        const isBranch = hasChildren(parentFields, fullPath);
        return (
          <button
            key={s}
            type="button"
            className={isBranch ? styles.chipBranch : styles.chip}
            onMouseDown={e => {
              e.preventDefault();
              if (isBranch) {
                onDrillDown(fullPath + '.');
              } else {
                onSelect(fullPath);
              }
            }}
          >
            {s}{isBranch ? '.' : ''}
          </button>
        );
      })}
    </div>
  );
}

export function SelectConfigPanel({ config, onConfigChange, parentFields }: SelectConfigPanelProps) {
  const fields = config.fields ?? [];
  const [newField, setNewField] = useState('');
  const [error, setError] = useState('');
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const commit = (updated: string[]) =>
    onConfigChange('fields', JSON.stringify(updated));

  const handleFieldChange = (index: number, value: string) => {
    const updated = [...fields];
    updated[index] = value;
    commit(updated);
  };

  const handleRemove = (index: number) => {
    commit(fields.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    const key = newField.trim();
    if (!key) { setError('enter a field name'); return; }
    if (fields.includes(key)) { setError(`"${key}" already exists`); return; }
    commit([...fields, key]);
    setNewField('');
    setError('');
  };

  const hasParent = parentFields.length > 0;

  const fieldInvalid = (f: string) => {
    if (!hasParent || !f) return false;
    return !parentFields.includes(f) && !parentFields.includes(f.split('.')[0]);
  };

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>fields</span>
      {fields.map((f, i) => {
        const invalid = fieldInvalid(f);
        return (
          <div key={i}>
            <div className={styles.fieldRow}>
              <input
                className={`${styles.fieldRowInput} ${invalid ? styles.fieldInputError : ''}`}
                value={f}
                onChange={e => handleFieldChange(i, e.target.value)}
                onFocus={() => setFocusedIndex(i)}
                onBlur={() => setFocusedIndex(null)}
              />
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => handleRemove(i)}
              >
                x
              </button>
            </div>
            {invalid && <span className={styles.errorText}>field not found</span>}
            {focusedIndex === i && hasParent && (
              <FieldSuggestions
                parentFields={parentFields}
                value={f}
                onSelect={path => handleFieldChange(i, path)}
                onDrillDown={prefix => handleFieldChange(i, prefix)}
              />
            )}
          </div>
        );
      })}
      <div>
        <div className={styles.fieldRow}>
          <input
            className={`${styles.fieldRowInput} ${error ? styles.fieldInputError : ''}`}
            value={newField}
            placeholder="field name"
            onChange={e => { setNewField(e.target.value); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            onFocus={() => setFocusedIndex(-1)}
            onBlur={() => setFocusedIndex(null)}
          />
          <button
            type="button"
            className={styles.modeToggle}
            onClick={handleAdd}
          >
            +
          </button>
        </div>
        {error && <span className={styles.errorText}>{error}</span>}
        {focusedIndex === -1 && hasParent && (
          <FieldSuggestions
            parentFields={parentFields}
            value={newField}
            onSelect={path => { setNewField(path); }}
            onDrillDown={prefix => { setNewField(prefix); }}
          />
        )}
      </div>
    </div>
  );
}
