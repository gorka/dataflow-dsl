import { useState, useCallback, useRef, useEffect } from 'react';
import { JsonView, darkStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import { DslEditor } from './DslEditor';
import { OutputViewer } from './OutputViewer';
import { DocsPanel } from './DocsPanel';
import { NodeConfigPanel } from './NodeConfigPanel';
import { BlurInput } from '../shared/BlurInput';
import { TabBar } from '../shared/TabBar';
import { PillTabs } from '../shared/PillTabs';
import type { NodeType, GraphNode, GraphEdge, ExecutionResult } from '../types';
import styles from './RightPanel.module.css';

const TYPE_COLORS: Record<NodeType, string> = {
  source: '#5865f2',
  filter: '#43b581',
  map: '#faa61a',
  select: '#9b59b6',
  join: '#f04747',
};

const inputExpandNode = (level: number) => level < 2;

type GlobalTab = 'dsl' | 'docs';
type NodeTab = 'config' | 'input' | 'output' | 'docs';
type ConfigSubTab = 'visual' | 'dsl';

const NODE_TAB_LABELS: Partial<Record<string, string>> = {};

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
  onNodeRename?: (oldId: string, newId: string) => void;
  nodeIds?: string[];
  registryEdges?: GraphEdge[];
  parentFields?: string[];
  selectedParentId?: string;
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
  onNodeRename,
  nodeIds = [],
  registryEdges = [],
  parentFields = [],
  selectedParentId,
}: RightPanelProps) {
  const [globalTab, setGlobalTab] = useState<GlobalTab>('dsl');
  const [nodeTab, setNodeTab] = useState<NodeTab>('config');
  const [configSubTab, setConfigSubTab] = useState<ConfigSubTab>('visual');
  const [bottomTab, setBottomTab] = useState<NodeTab | null>(null);
  const [splitPct, setSplitPct] = useState(50);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const draggingDivider = useRef(false);

  const parentData = selectedParentId ? results.get(selectedParentId)?.data : undefined;
  const hasInput = !!parentData;

  useEffect(() => {
    if (bottomTab === 'input' && !hasInput) setBottomTab(null);
  }, [hasInput, bottomTab]);

  const nodeTabs: NodeTab[] = hasInput
    ? ['config', 'input', 'output', 'docs']
    : ['config', 'output', 'docs'];

  const handleTabSelect = useCallback((tab: NodeTab) => {
    if (tab === bottomTab) setBottomTab(null);
    setNodeTab(tab);
  }, [bottomTab]);

  const handleSendToBottom = useCallback((tab: NodeTab) => {
    if (tab === nodeTab) return;
    setBottomTab(tab);
  }, [nodeTab]);

  const handleCloseBottom = useCallback(() => {
    setBottomTab(null);
  }, []);

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingDivider.current = true;
    const onMouseMove = (ev: MouseEvent) => {
      if (!draggingDivider.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const pct = ((ev.clientY - rect.top) / rect.height) * 100;
      setSplitPct(Math.max(15, Math.min(85, pct)));
    };
    const onMouseUp = () => {
      draggingDivider.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  function renderTabContent(tab: NodeTab) {
    switch (tab) {
      case 'config':
        return (
          <div className={styles.tabContent}>
            <PillTabs tabs={['visual', 'dsl'] as const} active={configSubTab} onSelect={setConfigSubTab} labels={{ dsl: 'DSL' }} />
            {configSubTab === 'visual' ? (
              <div className={styles.configContent}>
                <NodeConfigPanel
                  nodeId={selectedNodeId!}
                  nodeType={selectedNodeType!}
                  config={selectedNodeConfig!}
                  onConfigChange={onConfigChange!}
                  nodeIds={nodeIds}
                  parentFields={parentFields}
                />
              </div>
            ) : (
              <DslEditor
                code={code}
                onChange={onCodeChange}
                selectedNodeId={selectedNodeId}
                snippetNodeId={selectedNodeId ?? undefined}
                nodeIds={nodeIds}
                results={results}
                edges={registryEdges}
              />
            )}
          </div>
        );
      case 'input':
        return (
          <div className={styles.inputView}>
            {parentData ? (
              <JsonView data={parentData.items} shouldExpandNode={inputExpandNode} style={darkStyles} clickToExpandNode />
            ) : null}
          </div>
        );
      case 'output':
        return <OutputViewer selectedNodeId={selectedNodeId} results={results} code={code} />;
      case 'docs':
        return <DocsPanel nodeType={selectedNodeType} />;
    }
  }

  if (!selectedNodeId || !selectedNodeType || !selectedNodeConfig || !onConfigChange) {
    return (
      <div className={styles.panel}>
        <TabBar tabs={['dsl', 'docs'] as const} active={globalTab} onSelect={setGlobalTab} labels={{ dsl: 'DSL' }} />
        <div className={styles.content}>
          {globalTab === 'dsl' && (
            <DslEditor
              code={code}
              onChange={onCodeChange}
              selectedNodeId={null}
              onNodeSelect={onNodeHighlight}
              nodeIds={nodeIds}
              results={results}
              edges={registryEdges}
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

  const isSplit = bottomTab !== null;

  return (
    <div className={styles.panel}>
      <div className={styles.nodeHeader}>
        <BlurInput
          className={styles.nodeNameInput}
          value={selectedNodeId}
          onCommit={newId => {
            const trimmed = newId.trim();
            if (trimmed && trimmed !== selectedNodeId && onNodeRename) {
              onNodeRename(selectedNodeId, trimmed);
            }
          }}
        />
        <span className={styles.typeBadge} style={{ background: TYPE_COLORS[selectedNodeType] }}>
          {selectedNodeType}
        </span>
      </div>

      <TabBar
        tabs={nodeTabs}
        active={nodeTab}
        onSelect={handleTabSelect}
        labels={NODE_TAB_LABELS}
        onSendToBottom={handleSendToBottom}
        bottomTab={bottomTab}
      />

      <div className={styles.content}>
        <div className={styles.splitContainer} ref={splitContainerRef}>
          <div className={styles.topPane} style={isSplit ? { height: `${splitPct}%` } : { flex: 1 }}>
            {renderTabContent(nodeTab)}
          </div>
          {isSplit && (
            <>
              <div className={styles.splitDivider} onMouseDown={onDividerMouseDown} />
              <div className={styles.bottomPane} style={{ height: `${100 - splitPct}%` }}>
                <div className={styles.bottomPaneHeader}>
                  <span className={styles.bottomPaneLabel}>{NODE_TAB_LABELS[bottomTab!] ?? bottomTab}</span>
                  <button className={styles.closeBtn} onClick={handleCloseBottom}>×</button>
                </div>
                {renderTabContent(bottomTab!)}
              </div>
            </>
          )}
        </div>
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
