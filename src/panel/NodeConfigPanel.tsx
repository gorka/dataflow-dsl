import { useState, useEffect } from 'react';
import type { NodeType, GraphNode, SourceConfig, FilterConfig, MapConfig, SelectConfig, JoinConfig } from '../types';
import { BlurInput } from '../shared/BlurInput';
import { ParamRows } from '../shared/ParamRows';
import styles from './NodeConfigPanel.module.css';

interface NodeConfigPanelProps {
  nodeId: string;
  nodeType: NodeType;
  config: GraphNode['config'];
  onConfigChange: (key: string, value: string) => void;
  nodeIds: string[];
}

function SourceConfigPanel({ config, onConfigChange, nodeIds }: {
  config: SourceConfig;
  onConfigChange: (key: string, value: string) => void;
  nodeIds: string[];
}) {
  const [localEndpoint, setLocalEndpoint] = useState(config.endpoint ?? '');
  useEffect(() => { setLocalEndpoint(config.endpoint ?? ''); }, [config.endpoint]);

  const commitEndpoint = () => {
    if (localEndpoint !== config.endpoint) {
      onConfigChange('endpoint', JSON.stringify(localEndpoint));
    }
  };

  return (
    <>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>endpoint</span>
        <input
          className={styles.fieldInput}
          value={localEndpoint}
          onChange={e => setLocalEndpoint(e.target.value)}
          onBlur={commitEndpoint}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>method</span>
        <BlurInput
          className={styles.fieldInput}
          value={config.method ?? 'GET'}
          onCommit={v => onConfigChange('method', JSON.stringify(v))}
        />
      </div>
      <ParamRows endpoint={localEndpoint} config={config} nodeIds={nodeIds} onConfigChange={onConfigChange} styles={styles} />
    </>
  );
}

export function NodeConfigPanel({ nodeType, config, onConfigChange, nodeIds }: NodeConfigPanelProps) {
  if (!config) return null;

  return (
    <div className={styles.config}>
      {nodeType === 'source' && (
        <SourceConfigPanel config={config as SourceConfig} onConfigChange={onConfigChange} nodeIds={nodeIds} />
      )}
      {nodeType === 'filter' && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>expression</span>
          <BlurInput
            className={styles.fieldInput}
            value={(config as FilterConfig).expression}
            onCommit={v => onConfigChange('expression', JSON.stringify(v))}
          />
        </div>
      )}
      {nodeType === 'map' && (() => {
        const mc = config as MapConfig;
        const mapStr = Object.entries(mc.mapping).map(([k, v]) => `${k}:${v}`).join(', ');
        return (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>mapping (newKey:oldKey, ...)</span>
            <BlurInput
              className={styles.fieldInput}
              value={mapStr}
              placeholder="newKey:oldKey, ..."
              onCommit={v => {
                const obj: Record<string, string> = {};
                v.split(',').forEach(pair => {
                  const [k, val] = pair.split(':').map(s => s.trim());
                  if (k && val) obj[k] = val;
                });
                onConfigChange('mapping', JSON.stringify(obj));
              }}
            />
          </div>
        );
      })()}
      {nodeType === 'select' && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>fields (comma-separated)</span>
          <BlurInput
            className={styles.fieldInput}
            value={(config as SelectConfig).fields.join(', ')}
            placeholder="field1, field2, ..."
            onCommit={v => {
              const fields = v.split(',').map(s => s.trim()).filter(Boolean);
              onConfigChange('fields', JSON.stringify(fields));
            }}
          />
        </div>
      )}
      {nodeType === 'join' && (() => {
        const jc = config as JoinConfig;
        return (
          <>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>source node</span>
              <select
                className={styles.fieldSelect}
                value={jc.nodeId}
                onChange={e => onConfigChange('nodeId', JSON.stringify(e.target.value))}
              >
                <option value="">select node...</option>
                {nodeIds.map(id => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>embed as</span>
              <BlurInput
                className={styles.fieldInput}
                value={jc.as ?? ''}
                placeholder="field name"
                onCommit={v => onConfigChange('as', JSON.stringify(v))}
              />
            </div>
          </>
        );
      })()}
    </div>
  );
}
