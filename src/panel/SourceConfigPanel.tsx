import { useState, useEffect } from 'react';

import type { SourceConfig } from '../types';
import { BlurInput } from '../shared/BlurInput';
import { ParamRows } from '../shared/ParamRows';
import styles from './NodeConfigPanel.module.css';

interface SourceConfigPanelProps {
  config: SourceConfig;
  onConfigChange: (key: string, value: string) => void;
  nodeIds: string[];
}

export function SourceConfigPanel({ config, onConfigChange, nodeIds }: SourceConfigPanelProps) {
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
