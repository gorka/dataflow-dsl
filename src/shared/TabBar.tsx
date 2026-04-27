import styles from './TabBar.module.css';

interface TabBarProps<T extends string> {
  tabs: readonly T[];
  active: T;
  onSelect: (tab: T) => void;
  labels?: Partial<Record<T, string>>;
  onSendToBottom?: (tab: T) => void;
  bottomTab?: T | null;
}

export function TabBar<T extends string>({ tabs, active, onSelect, labels, onSendToBottom, bottomTab }: TabBarProps<T>) {
  return (
    <div className={styles.tabs}>
      {tabs.map(tab => (
        <div key={tab} className={`${styles.tab} ${tab === active ? styles.active : ''} ${tab === bottomTab ? styles.pinned : ''}`}>
          <button className={styles.tabBtn} onClick={() => onSelect(tab)}>
            {labels?.[tab] ?? tab}
          </button>
          {onSendToBottom && tab !== active && (
            <button
              className={styles.sendBtn}
              onClick={() => onSendToBottom(tab)}
              aria-label={`Send ${labels?.[tab] ?? tab} to bottom`}
            >
              ↓
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
