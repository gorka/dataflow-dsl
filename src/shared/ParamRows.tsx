import type { SourceConfig } from '../types';
import { ParamRow, extractPlaceholders, serializeParamValue } from './ParamRow';

export function ParamRows({ endpoint, config, nodeIds, onConfigChange, styles }: {
  endpoint: string;
  config: SourceConfig;
  nodeIds: string[];
  onConfigChange?: (key: string, value: string) => void;
  styles: Record<string, string>;
}) {
  const placeholders = extractPlaceholders(endpoint);
  const params = config.params ?? {};
  const allKeys = [...new Set([...placeholders, ...Object.keys(params)])];

  if (allKeys.length === 0) return null;

  const handleCommit = (paramKey: string, serialized: string) => {
    const entries = allKeys.map(k => {
      if (k === paramKey) return `${k}: ${serialized}`;
      return `${k}: ${serializeParamValue(params[k])}`;
    });
    onConfigChange?.('params', `{ ${entries.join(', ')} }`);
  };

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>params</span>
      {allKeys.map(k => (
        <ParamRow
          key={k}
          paramKey={k}
          value={params[k]}
          nodeIds={nodeIds}
          onCommit={serialized => handleCommit(k, serialized)}
          styles={styles}
        />
      ))}
    </div>
  );
}
