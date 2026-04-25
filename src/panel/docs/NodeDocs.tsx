import React from 'react';
import type { NodeType } from '../../types';
import styles from '../DocsPanel.module.css';

export function SourceDocs() {
  return (
    <>
      <h3><span className={styles.nodeColor} style={{ background: '#5865f2' }} />Source</h3>
      <p>Fetches data from an API endpoint. Configure the URL, HTTP method, and params directly on the node.</p>
      <ul>
        <li><strong>endpoint</strong> — URL template with <code>{'{param}'}</code> placeholders, e.g. <code>https://api.com/items/{'{id}'}</code></li>
        <li><strong>method</strong> — GET or POST</li>
        <li><strong>params</strong> — values to interpolate into the endpoint. Can be literals (<code>{`{ id: 1 }`}</code>) or <code>ref()</code> to resolve from another node's output</li>
      </ul>
    </>
  );
}

export function FilterDocs() {
  return (
    <>
      <h3><span className={styles.nodeColor} style={{ background: '#43b581' }} />Filter</h3>
      <p>Keeps only items matching a JavaScript expression evaluated against each item.</p>
      <ul>
        <li><strong>expression</strong> — e.g. <code>height &gt; 100</code> or <code>name.includes("Sky")</code></li>
      </ul>
    </>
  );
}

export function MapDocs() {
  return (
    <>
      <h3><span className={styles.nodeColor} style={{ background: '#faa61a' }} />Map</h3>
      <p>Renames or reshapes fields. Each mapping entry maps a new key to an existing field path.</p>
      <ul>
        <li><strong>mapping</strong> — comma-separated <code>newKey:oldKey</code> pairs, e.g. <code>nombre:name, altura:height</code></li>
        <li><strong>spread</strong> — use <code>{"\"...\""}</code> as the key to extract all fields from a nested path, e.g. <code>{'{ "...": "result.properties" }'}</code> flattens <code>{'{ result: { properties: { name, ... } } }'}</code> into <code>{'{ name, ... }'}</code></li>
      </ul>
    </>
  );
}

export function SelectDocs() {
  return (
    <>
      <h3><span className={styles.nodeColor} style={{ background: '#9b59b6' }} />Select</h3>
      <p>Picks only the specified fields from each item, discarding the rest.</p>
      <ul>
        <li><strong>fields</strong> — comma-separated field names, e.g. <code>name, height, mass</code></li>
      </ul>
    </>
  );
}

export function JoinDocs() {
  return (
    <>
      <h3><span className={styles.nodeColor} style={{ background: '#f04747' }} />Join</h3>
      <p>Merges data from another node into the current collection.</p>
      <ul>
        <li><strong>source node</strong> — the node ID to pull data from</li>
        <li><strong>embed as</strong> — nest the joined data under this field name</li>
      </ul>
    </>
  );
}

export const NODE_DOCS: Record<NodeType, () => React.JSX.Element> = {
  source: SourceDocs,
  filter: FilterDocs,
  map: MapDocs,
  select: SelectDocs,
  join: JoinDocs,
};

export function RefDocs() {
  return (
    <>
      <h3>ref(nodeId, field)</h3>
      <p>
        Resolves values from another node's output and injects them into params.
        Use <code>{'{paramName}'}</code> in the endpoint to interpolate.
        If the field contains an array, each value produces a separate fetch and results are merged.
      </p>
      <pre>{`// Full URL from upstream — use {url} as the endpoint
source("homeworld", {
  endpoint: "{url}",
  params: { url: ref("person", "homeworld") }
});

// ID from upstream — build the URL with {id}
source("details", {
  endpoint: "https://api.example.com/items/{id}",
  params: { id: ref("list", "itemId") }
});`}</pre>
    </>
  );
}

export function SyntaxDocs() {
  return (
    <>
      <h2>DSL Syntax</h2>
      <p>The DSL is a sequence of function calls. Each call defines a node. Transforms reference their parent by ID.</p>
      <pre>{`source("person", {
  endpoint: "https://swapi.tech/api/people/{id}",
  params: { id: 1 }
});

select("basics", "person", ["name", "height", "mass"]);

filter("tall", "person", "height > 100");

map("renamed", "person", { nombre: "name" });

source("films", {
  endpoint: "{url}",
  params: { url: ref("person", "films") }
});

join("withFilms", "person", "films", { as: "filmData" });`}</pre>
      <RefDocs />
    </>
  );
}

export function UsageDocs() {
  return (
    <>
      <h2>How to Use</h2>

      <h3>Adding Nodes</h3>
      <p>Drag a node type from the left sidebar onto the canvas. Source nodes are added to the DSL immediately. Transform nodes appear as "unlinked" until connected to a parent.</p>

      <h3>Editing Nodes</h3>
      <p>Click on any node to edit its configuration in the right panel. Changes are synced back to the DSL code in real time. You can also edit the DSL code directly in the DSL tab.</p>

      <h3>Selection Sync</h3>
      <p>Clicking a node on the graph shows its config in the panel. Moving your cursor in the DSL editor selects the corresponding node on the graph.</p>

      <h3>Running the Pipeline</h3>
      <p>Click the <strong>Run</strong> button in the toolbar. Nodes execute in topological order. Results appear in the Output section of the panel.</p>

      <h3>Controls</h3>
      <ul>
        <li><strong>Run</strong> — execute the pipeline</li>
        <li><strong>Auto Layout</strong> — re-arrange nodes using dagre layout</li>
        <li><strong>Clear</strong> — remove all nodes and reset</li>
      </ul>
    </>
  );
}
