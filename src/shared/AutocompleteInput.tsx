import { useState, useRef, useEffect } from 'react';

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
  const [forceOpen, setForceOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightIndex >= 0 && suggestionsRef.current) {
      const el = suggestionsRef.current.children[highlightIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const exactMatch = suggestions?.length === 1 && suggestionPrefix + suggestions[0] === value;
  const showSuggestions = isFocused && (value.length > 0 || forceOpen) && suggestions && suggestions.length > 0 && !exactMatch;
  const inputError = isInvalid || !!error;

  const selectSuggestion = (s: string) => {
    const fullPath = suggestionPrefix + s;
    const isBranch = branchPaths?.has(s) ?? false;
    if (isBranch) {
      onSuggestionDrillDown?.(fullPath + '.');
    } else {
      onSuggestionSelect?.(fullPath);
    }
    setHighlightIndex(-1);
  };

  return (
    <div className={styles.fieldRowGroup}>
      <div className={styles.fieldRow}>
        <input
          className={`${styles.fieldRowInput} ${inputError ? styles.fieldInputError : ''}`}
          value={value}
          placeholder={placeholder}
          onChange={e => { onChange(e.target.value); setForceOpen(false); setHighlightIndex(-1); }}
          onKeyDown={e => {
            if (showSuggestions && suggestions) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlightIndex(i => (i + 1) % suggestions.length);
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlightIndex(i => (i - 1 + suggestions.length) % suggestions.length);
                return;
              }
              if (e.key === 'Enter' && highlightIndex >= 0) {
                e.preventDefault();
                selectSuggestion(suggestions[highlightIndex]);
                return;
              }
              if (e.key === 'Escape') {
                setForceOpen(false);
                setHighlightIndex(-1);
                return;
              }
            }
            if (e.key === 'ArrowDown' && !value && suggestions?.length) {
              e.preventDefault();
              setForceOpen(true);
              setHighlightIndex(0);
              return;
            }
            if (e.key === 'Enter') onSubmit();
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => { setIsFocused(false); setForceOpen(false); setHighlightIndex(-1); }}
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
        <div className={styles.suggestions} ref={suggestionsRef}>
          {suggestions!.map((s, i) => {
            const isBranch = branchPaths?.has(s) ?? false;
            const isHighlighted = i === highlightIndex;
            return (
              <button
                key={s}
                type="button"
                className={`${isBranch ? styles.suggestionBranch : styles.suggestionItem} ${isHighlighted ? styles.suggestionHighlighted : ''}`}
                onMouseDown={e => {
                  e.preventDefault();
                  selectSuggestion(s);
                }}
                onMouseEnter={() => setHighlightIndex(i)}
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
