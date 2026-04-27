import type { NodeType, GraphNode, SourceConfig, FilterConfig, MapConfig, SelectConfig, JoinConfig } from '../types';
import { BlurInput } from '../shared/BlurInput';
import { SourceConfigPanel } from './SourceConfigPanel';
import styles from './NodeConfigPanel.module.css';

interface NodeConfigPanelProps {
  nodeId: string;
  nodeType: NodeType;
  config: GraphNode['config'];
  onConfigChange: (key: string, value: string) => void;
  nodeIds: string[];
}

function MapConfigFields({ config, onConfigChange }: { config: MapConfig; onConfigChange: (key: string, value: string) => void }) {
  const mapStr = Object.entries(config.mapping).map(([k, v]) => `${k}:${v}`).join(', ');
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
}

function JoinConfigFields({ config, onConfigChange, nodeIds }: { config: JoinConfig; onConfigChange: (key: string, value: string) => void; nodeIds: string[] }) {
  return (
    <>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>source node</span>
        <select
          className={styles.fieldSelect}
          value={config.nodeId}
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
          value={config.as ?? ''}
          placeholder="field name"
          onCommit={v => onConfigChange('as', JSON.stringify(v))}
        />
      </div>
    </>
  );
}

export function NodeConfigPanel({ nodeId, nodeType, config, onConfigChange, nodeIds }: NodeConfigPanelProps) {
  if (!config) return null;

  return (
    <div className={styles.config}>
      {nodeType === 'source' && (
        <SourceConfigPanel config={config as SourceConfig} onConfigChange={onConfigChange} nodeIds={nodeIds} currentNodeId={nodeId} />
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
      {nodeType === 'map' && (
        <MapConfigFields config={config as MapConfig} onConfigChange={onConfigChange} />
      )}
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
      {nodeType === 'join' && (
        <JoinConfigFields config={config as JoinConfig} onConfigChange={onConfigChange} nodeIds={nodeIds} />
      )}
    </div>
  );
}
