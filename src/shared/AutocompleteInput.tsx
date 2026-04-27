import { useState } from 'react';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  actionLabel: '+' | 'x';
  placeholder?: string;
  error?: string;
  isInvalid?: boolean;
  suggestions?: string[];
  onSuggestionSelect?: (path: string) => void;
  onSuggestionDrillDown?: (prefix: string) => void;
  branchPaths?: Set<string>;
  suggestionPrefix?: string;
  styles: Record<string, string>;
}

export function AutocompleteInput({
  value, onChange, onSubmit, actionLabel, placeholder, error, isInvalid,
  suggestions, onSuggestionSelect, onSuggestionDrillDown, branchPaths,
  suggestionPrefix = '', styles,
}: AutocompleteInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const exactMatch = suggestions?.length === 1 && suggestionPrefix + suggestions[0] === value;
  const showSuggestions = isFocused && suggestions && suggestions.length > 0 && !exactMatch;
  const inputError = isInvalid || !!error;

  return (
    <div className={styles.fieldRowGroup}>
      <div className={styles.fieldRow}>
        <input
          className={`${styles.fieldRowInput} ${inputError ? styles.fieldInputError : ''}`}
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <button
          type="button"
          className={`${styles.fieldRowBtn} ${actionLabel === 'x' ? styles.fieldRowBtnRemove : ''}`}
          onClick={onSubmit}
        >
          {actionLabel}
        </button>
      </div>
      {error && <span className={styles.errorText}>{error}</span>}
      {showSuggestions && (
        <div className={styles.suggestions}>
          {suggestions!.map(s => {
            const fullPath = suggestionPrefix + s;
            const isBranch = branchPaths?.has(s) ?? false;
            return (
              <button
                key={s}
                type="button"
                className={isBranch ? styles.suggestionBranch : styles.suggestionItem}
                onMouseDown={e => {
                  e.preventDefault();
                  if (isBranch) {
                    onSuggestionDrillDown?.(fullPath + '.');
                  } else {
                    onSuggestionSelect?.(fullPath);
                  }
                }}
              >
                {s}{isBranch ? '.' : ''}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
