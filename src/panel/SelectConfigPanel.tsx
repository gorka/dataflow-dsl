import { useState } from 'react';
import type { SelectConfig } from '../types';
import { AutocompleteInput } from '../shared/AutocompleteInput';
import { getSuggestions, getBranchPaths, getSuggestionPrefix } from '../shared/fieldSuggestions';
import styles from './NodeConfigPanel.module.css';

interface SelectConfigPanelProps {
  config: SelectConfig;
  onConfigChange: (key: string, value: string) => void;
  parentFields: string[];
}

export function SelectConfigPanel({ config, onConfigChange, parentFields }: SelectConfigPanelProps) {
  const fields = config.fields ?? [];
  const [newField, setNewField] = useState('');
  const [error, setError] = useState('');

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

  const addField = (key: string) => {
    const trimmed = key.trim();
    if (!trimmed) { setError('enter a field name'); return; }
    if (fields.includes(trimmed)) { setError(`"${trimmed}" already exists`); return; }
    commit([...fields, trimmed]);
    setNewField('');
    setError('');
  };

  const hasParent = parentFields.length > 0;

  const fieldInvalid = (f: string) => {
    if (!hasParent || !f) return false;
    return !parentFields.includes(f) && !parentFields.includes(f.split('.')[0]);
  };

  const autocompleteProps = (value: string) => {
    if (!hasParent) return {};
    const suggestions = getSuggestions(parentFields, value);
    const prefix = getSuggestionPrefix(value);
    const branchPaths = getBranchPaths(parentFields, suggestions, prefix);
    return { suggestions, branchPaths, suggestionPrefix: prefix };
  };

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>fields</span>
      {fields.map((f, i) => (
        <AutocompleteInput
          key={i}
          value={f}
          onChange={v => handleFieldChange(i, v)}
          onSubmit={() => handleRemove(i)}
          actionLabel="x"
          isInvalid={fieldInvalid(f)}
          error={fieldInvalid(f) ? 'field not found' : undefined}
          onSuggestionSelect={path => handleFieldChange(i, path)}
          onSuggestionDrillDown={prefix => handleFieldChange(i, prefix)}
          {...autocompleteProps(f)}
          styles={styles}
        />
      ))}
      <AutocompleteInput
        value={newField}
        onChange={v => { setNewField(v); setError(''); }}
        onSubmit={() => addField(newField)}
        actionLabel="+"
        placeholder="field name"
        error={error}
        onSuggestionSelect={path => addField(path)}
        onSuggestionDrillDown={prefix => setNewField(prefix)}
        {...autocompleteProps(newField)}
        styles={styles}
      />
    </div>
  );
}
