import styles from './PillTabs.module.css';

interface PillTabsProps<T extends string> {
  tabs: readonly T[];
  active: T;
  onSelect: (tab: T) => void;
  labels?: Partial<Record<T, string>>;
}

export function PillTabs<T extends string>({ tabs, active, onSelect, labels }: PillTabsProps<T>) {
  return (
    <div className={styles.bar}>
      {tabs.map(tab => (
        <button
          key={tab}
          className={`${styles.pill} ${tab === active ? styles.active : ''}`}
          onClick={() => onSelect(tab)}
        >
          {labels?.[tab] ?? tab}
        </button>
      ))}
    </div>
  );
}
