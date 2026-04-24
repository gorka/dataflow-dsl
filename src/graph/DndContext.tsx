import { createContext, useState, useContext, type ReactNode } from 'react';
import type { NodeType } from '../types';

interface DndContextValue {
  dragType: NodeType | null;
  setDragType: (type: NodeType | null) => void;
}

const DndCtx = createContext<DndContextValue>({
  dragType: null,
  setDragType: () => {},
});

export function DndProvider({ children }: { children: ReactNode }) {
  const [dragType, setDragType] = useState<NodeType | null>(null);
  return (
    <DndCtx.Provider value={{ dragType, setDragType }}>
      {children}
    </DndCtx.Provider>
  );
}

export function useDnd() {
  return useContext(DndCtx);
}
