import { useState } from 'react';
import { DslEditor } from './DslEditor';
import { OutputViewer } from './OutputViewer';
import type { ExecutionResult } from '../types';
import styles from './RightPanel.module.css';

type Tab = 'dsl' | 'output';

interface RightPanelProps {
  code: string;
  onCodeChange: (code: string) => void;
  selectedNodeId: string | null;
  results: Map<string, ExecutionResult>;
}

export function RightPanel({ code, onCodeChange, selectedNodeId, results }: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('dsl');

  return (
    <div className={styles.panel}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'dsl' ? styles.active : ''}`}
          onClick={() => setActiveTab('dsl')}
        >
          DSL
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'output' ? styles.active : ''}`}
          onClick={() => setActiveTab('output')}
        >
          Output
        </button>
      </div>
      <div className={styles.content}>
        {activeTab === 'dsl' && <DslEditor code={code} onChange={onCodeChange} />}
        {activeTab === 'output' && <OutputViewer selectedNodeId={selectedNodeId} results={results} />}
      </div>
    </div>
  );
}
