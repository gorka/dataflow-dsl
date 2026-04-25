import { useDnd } from './DndContext';
import type { NodeType } from '../types';
import styles from './NodeMenu.module.css';

const NODE_ITEMS: { type: NodeType; label: string; color: string }[] = [
  { type: 'source', label: 'Source', color: '#5865f2' },
  { type: 'filter', label: 'Filter', color: '#43b581' },
  { type: 'map', label: 'Map', color: '#faa61a' },
  { type: 'select', label: 'Select', color: '#9b59b6' },
  { type: 'join', label: 'Join', color: '#f04747' },
];

export function NodeMenu() {
  const { setDragType } = useDnd();

  function onDragStart(e: React.DragEvent, type: NodeType) {
    setDragType(type);
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div className={styles.menu}>
      <div className={styles.title}>Nodes</div>
      {NODE_ITEMS.map(({ type, label, color }) => (
        <div
          key={type}
          className={styles.item}
          draggable
          onDragStart={(e) => onDragStart(e, type)}
          style={{ borderLeftColor: color }}
        >
          {label}
        </div>
      ))}
    </div>
  );
}
