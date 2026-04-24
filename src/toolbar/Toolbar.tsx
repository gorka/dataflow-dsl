import styles from './Toolbar.module.css';

interface ToolbarProps {
  onRun: () => void;
  onAutoLayout: () => void;
  onClear: () => void;
  isRunning: boolean;
}

export function Toolbar({ onRun, onAutoLayout, onClear, isRunning }: ToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        <button className={styles.runButton} onClick={onRun} disabled={isRunning}>
          {isRunning ? '⟳ Running...' : '▶ Run'}
        </button>
        <button className={styles.button} onClick={onAutoLayout}>Auto-layout</button>
        <button className={styles.button} onClick={onClear}>Clear</button>
      </div>
      <div className={styles.title}>Dataflow DSL</div>
    </div>
  );
}
