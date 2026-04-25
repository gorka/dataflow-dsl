import { useState } from 'react';

import { EXAMPLES, type Tier } from '../dsl/examples';
import styles from './Toolbar.module.css';

interface ToolbarProps {
  onRun: () => void;
  onAutoLayout: () => void;
  onClear: () => void;
  onExampleSelect: (code: string) => void;
  isRunning: boolean;
  showHint?: boolean;
}

export function Toolbar({ onRun, onAutoLayout, onClear, onExampleSelect, isRunning, showHint }: ToolbarProps) {
  const [hintDismissed, setHintDismissed] = useState(false);
  const hintVisible = showHint && !hintDismissed;

  const handleExampleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = Number(e.target.value);
    if (!isNaN(idx) && EXAMPLES[idx]) {
      onExampleSelect(EXAMPLES[idx].code);
      setHintDismissed(true);
    }
  };

  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        <button className={styles.runButton} onClick={onRun} disabled={isRunning}>
          {isRunning ? '⟳ Running...' : '▶ Run'}
        </button>
        <button className={styles.button} onClick={onAutoLayout}>Auto-layout</button>
        <button className={styles.button} onClick={onClear}>Clear</button>
        <div className={styles.selectWrapper}>
          <select
            className={styles.exampleSelect}
            value=""
            onChange={handleExampleSelect}
          >
            <option value="" disabled>Load example...</option>
            {(['Simple', 'Moderate', 'Advanced'] as Tier[]).map(tier => (
              <optgroup key={tier} label={tier}>
                {EXAMPLES.map((ex, i) => ex.tier === tier && (
                  <option key={i} value={i}>{ex.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {hintVisible && (
            <div className={styles.hint}>
              <span>Pick an example to get started</span>
              <button className={styles.hintClose} onClick={() => setHintDismissed(true)}>x</button>
              <div className={styles.hintArrow} />
            </div>
          )}
        </div>
      </div>
      <div className={styles.title}>Dataflow DSL</div>
    </div>
  );
}
