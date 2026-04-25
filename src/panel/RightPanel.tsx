import { useState, useCallback, useRef } from 'react';
import { DslEditor } from './DslEditor';
import { OutputViewer } from './OutputViewer';
import { DocsPanel } from './DocsPanel';
import { NodeConfigPanel } from './NodeConfigPanel';
import type { NodeType, GraphNode, ExecutionResult } from '../types';
import styles from './RightPanel.module.css';

const TYPE_COLORS: Record<NodeType, string> = {
  source: '#5865f2',
  filter: '#43b581',
  map: '#faa61a',
  select: '#9b59b6',
  join: '#f04747',
};

type GlobalTab = 'dsl' | 'docs';
type NodeTab = 'config' | 'output' | 'docs';

interface RightPanelProps {
  code: string;
  onCodeChange: (code: string) => void;
  selectedNodeId: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
  onNodeHighlight?: (nodeId: string | null) => void;
  results: Map<string, ExecutionResult>;
  error?: string;
  selectedNodeType?: NodeType;
  selectedNodeConfig?: GraphNode['config'];
  onConfigChange?: (key: string, value: string) => void;
  nodeIds?: string[];
}

export function RightPanel({
  code,
  onCodeChange,
  selectedNodeId,
  onNodeHighlight,
  results,
  error,
  selectedNodeType,
  selectedNodeConfig,
  onConfigChange,
  nodeIds = [],
}: RightPanelProps) {
  const [globalTab, setGlobalTab] = useState<GlobalTab>('dsl');
  const [nodeTab, setNodeTab] = useState<NodeTab>('config');
  const [configPct, setConfigPct] = useState(50);
  const configTabRef = useRef<HTMLDivElement>(null);
  const draggingDivider = useRef(false);

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingDivider.current = true;
    const onMouseMove = (ev: MouseEvent) => {
      if (!draggingDivider.current || !configTabRef.current) return;
      const rect = configTabRef.current.getBoundingClientRect();
      const pct = ((ev.clientY - rect.top) / rect.height) * 100;
      setConfigPct(Math.max(15, Math.min(85, pct)));
    };
    const onMouseUp = () => {
      draggingDivider.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  if (!selectedNodeId || !selectedNodeType || !selectedNodeConfig || !onConfigChange) {
    return (
      <div className={styles.panel}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${globalTab === 'dsl' ? styles.active : ''}`}
            onClick={() => setGlobalTab('dsl')}
          >
            DSL
          </button>
          <button
            className={`${styles.tab} ${globalTab === 'docs' ? styles.active : ''}`}
            onClick={() => setGlobalTab('docs')}
          >
            Docs
          </button>
        </div>
        <div className={styles.content}>
          {globalTab === 'dsl' && (
            <DslEditor
              code={code}
              onChange={onCodeChange}
              selectedNodeId={null}
              onNodeSelect={onNodeHighlight}
              nodeIds={nodeIds}
              results={results}
            />
          )}
          {globalTab === 'docs' && <DocsPanel />}
        </div>
        {error && (
          <div className={styles.errorBar}>
            <span className={styles.errorIcon}>!</span>
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.nodeHeader}>
        <span className={styles.nodeName}>{selectedNodeId}</span>
        <span className={styles.typeBadge} style={{ background: TYPE_COLORS[selectedNodeType] }}>
          {selectedNodeType}
        </span>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${nodeTab === 'config' ? styles.active : ''}`}
          onClick={() => setNodeTab('config')}
        >
          Config
        </button>
        <button
          className={`${styles.tab} ${nodeTab === 'output' ? styles.active : ''}`}
          onClick={() => setNodeTab('output')}
        >
          Output
        </button>
        <button
          className={`${styles.tab} ${nodeTab === 'docs' ? styles.active : ''}`}
          onClick={() => setNodeTab('docs')}
        >
          Docs
        </button>
      </div>

      <div className={styles.content}>
        {nodeTab === 'config' && (
          <div className={styles.configTab} ref={configTabRef}>
            <div className={styles.configFields} style={{ height: `${configPct}%` }}>
              <NodeConfigPanel
                nodeId={selectedNodeId}
                nodeType={selectedNodeType}
                config={selectedNodeConfig}
                onConfigChange={onConfigChange}
                nodeIds={nodeIds}
              />
            </div>
            <div className={styles.splitDivider} onMouseDown={onDividerMouseDown} />
            <div className={styles.dslSection} style={{ height: `${100 - configPct}%` }}>
              <DslEditor
                code={code}
                onChange={onCodeChange}
                selectedNodeId={selectedNodeId}
                snippetNodeId={selectedNodeId}
              />
            </div>
          </div>
        )}
        {nodeTab === 'output' && (
          <OutputViewer selectedNodeId={selectedNodeId} results={results} code={code} />
        )}
        {nodeTab === 'docs' && <DocsPanel nodeType={selectedNodeType} />}
      </div>
      {error && (
        <div className={styles.errorBar}>
          <span className={styles.errorIcon}>!</span>
          {error}
        </div>
      )}
    </div>
  );
}
