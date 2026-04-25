import type { NodeType } from '../types';
import {
  SourceDocs, FilterDocs, MapDocs, SelectDocs, JoinDocs,
  RefDocs, SyntaxDocs, UsageDocs, NODE_DOCS,
} from './docs/NodeDocs';
import styles from './DocsPanel.module.css';

interface DocsPanelProps {
  nodeType?: NodeType;
}

export function DocsPanel({ nodeType }: DocsPanelProps) {
  if (nodeType) {
    const DocComponent = NODE_DOCS[nodeType];
    return (
      <div className={styles.docs}>
        <DocComponent />
        {nodeType === 'source' && <RefDocs />}
      </div>
    );
  }

  return (
    <div className={styles.docs}>
      <h2>Dataflow DSL</h2>
      <p>
        A visual pipeline builder for fetching, transforming, and joining API data.
        Drag nodes onto the canvas, configure them from the UI, and hit <strong>Run</strong> to execute.
      </p>

      <h2>Node Types</h2>
      <SourceDocs />
      <FilterDocs />
      <MapDocs />
      <SelectDocs />
      <JoinDocs />

      <SyntaxDocs />
      <UsageDocs />
    </div>
  );
}
