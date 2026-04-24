# API Dataflow DSL + Visual Graph System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an app where users write JavaScript DSL code to define API data pipelines, visualize them as a DAG in React Flow, and execute them to fetch/transform data — with bidirectional sync between code and graph.

**Architecture:** DSL code is the source of truth. Evaluating it in a sandboxed runtime produces a node/edge registry. React Flow renders this registry. Graph edits mutate the DSL code via AST transforms (acorn/astring). Execution fetches APIs and runs transforms in topological order. All data flows as collections.

**Tech Stack:** Vite, React 19, TypeScript, @xyflow/react, @uiw/react-codemirror, acorn, astring, dagre, CSS Modules

---

## File Structure

```
src/
├── main.tsx                        # Entry point, renders App
├── App.tsx                         # Top-level layout: toolbar, graph, panel
├── App.module.css                  # Layout styles
├── types.ts                        # Shared types: GraphNode, GraphEdge, Collection, etc.
├── dsl/
│   ├── runtime.ts                  # DSL runtime: source(), ref(), NodeProxy with .filter/.map/.select/.join
│   ├── runtime.test.ts             # Tests for DSL evaluation → node/edge registry
│   ├── execute.ts                  # Execution engine: topo sort, fetch, transform
│   ├── execute.test.ts             # Tests for execution
│   ├── codegen.ts                  # Graph → DSL code generation (AST-based)
│   ├── codegen.test.ts             # Tests for code generation
│   └── default-pipeline.ts         # Default SWAPI pipeline code string
├── graph/
│   ├── GraphCanvas.tsx             # React Flow wrapper with drag/drop, node rendering
│   ├── GraphCanvas.module.css      # Graph canvas styles
│   ├── DndContext.tsx              # Drag-and-drop context for node menu → canvas
│   ├── NodeMenu.tsx                # Left sidebar with draggable node types
│   ├── NodeMenu.module.css         # Node menu styles
│   ├── nodes/
│   │   ├── SourceNode.tsx          # Custom React Flow node for source type
│   │   ├── SourceNode.module.css
│   │   ├── TransformNode.tsx       # Custom React Flow node for filter/map/select/join
│   │   ├── TransformNode.module.css
│   │   └── nodeTypes.ts            # Registry mapping type strings → components
│   ├── useGraphFromDsl.ts          # Hook: DSL code → React Flow nodes/edges (via runtime)
│   └── useDslFromGraph.ts          # Hook: graph edits → DSL code mutations (via codegen)
├── panel/
│   ├── RightPanel.tsx              # Tabbed panel: DSL editor + Output viewer
│   ├── RightPanel.module.css
│   ├── DslEditor.tsx               # CodeMirror 6 wrapper
│   ├── DslEditor.module.css
│   ├── OutputViewer.tsx            # JSON output display for selected node
│   └── OutputViewer.module.css
└── toolbar/
    ├── Toolbar.tsx                  # Run button, auto-layout, clear
    └── Toolbar.module.css
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `eslint.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/App.module.css`, `.gitignore`

- [ ] **Step 1: Initialize Vite project**

```bash
cd /Users/gpitarch/code/dataflow-dsl
npm create vite@latest . -- --template react-ts
```

Select "Ignore files and continue" if prompted about existing files.

- [ ] **Step 2: Install dependencies**

```bash
npm install @xyflow/react @uiw/react-codemirror @codemirror/lang-javascript acorn astring @dagrejs/dagre
npm install -D @types/node
```

- [ ] **Step 3: Verify it builds**

```bash
npm run build
```

Expected: successful build with no errors.

- [ ] **Step 4: Update `.gitignore`**

Add to `.gitignore`:

```
.superpowers/
```

- [ ] **Step 5: Replace `src/App.tsx` with the shell layout**

```tsx
import styles from './App.module.css';

function App() {
  return (
    <div className={styles.layout}>
      <div className={styles.toolbar}>Toolbar</div>
      <div className={styles.main}>
        <div className={styles.graphArea}>Graph</div>
        <div className={styles.panel}>Panel</div>
      </div>
      <div className={styles.statusBar}>Status</div>
    </div>
  );
}

export default App;
```

- [ ] **Step 6: Create `src/App.module.css`**

```css
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0a0a0f;
  color: #e0e0e0;
}

.toolbar {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: #13131a;
  border-bottom: 1px solid #2a2a35;
}

.main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.graphArea {
  flex: 2;
  position: relative;
  display: flex;
}

.panel {
  flex: 1;
  border-left: 1px solid #2a2a35;
  display: flex;
  flex-direction: column;
}

.statusBar {
  height: 28px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: #13131a;
  border-top: 1px solid #2a2a35;
  font-size: 12px;
  color: #666;
}
```

- [ ] **Step 7: Clean up default Vite files**

Delete `src/App.css`, `src/index.css`, `src/assets/`. Update `src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Update `index.html` to remove the default Vite CSS import and set title to "Dataflow DSL".

Reset body styles inline in `index.html`:

```html
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
</style>
```

- [ ] **Step 8: Verify dev server works**

```bash
npm run dev
```

Open in browser. Should show the three-section shell layout (toolbar / graph+panel / status bar).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold vite project with shell layout"
```

---

### Task 2: Shared Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Define core types**

```ts
export type NodeType = 'source' | 'filter' | 'map' | 'select' | 'join';

export interface RefValue {
  __ref: true;
  nodeId: string;
  field: string;
}

export interface SourceConfig {
  endpoint: string | RefValue;
  method?: 'GET' | 'POST';
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}

export interface FilterConfig {
  expression: string;
}

export interface MapConfig {
  mapping: Record<string, string>;
}

export interface SelectConfig {
  fields: string[];
}

export interface JoinConfig {
  nodeId: string;
  as?: string;
  on?: [string, string];
}

export interface GraphNode {
  id: string;
  type: NodeType;
  config: SourceConfig | FilterConfig | MapConfig | SelectConfig | JoinConfig;
  parentId?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'chain' | 'ref' | 'join';
}

export interface NodeRegistry {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Collection<T = Record<string, unknown>> {
  items: T[];
}

export interface ExecutionResult {
  nodeId: string;
  status: 'pending' | 'running' | 'success' | 'error';
  data?: Collection;
  error?: string;
  durationMs?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared type definitions"
```

---

### Task 3: DSL Runtime

**Files:**
- Create: `src/dsl/runtime.ts`, `src/dsl/runtime.test.ts`

- [ ] **Step 1: Write failing tests for the DSL runtime**

```ts
import { describe, it, expect } from 'vitest';
import { evaluateDsl } from './runtime';

describe('evaluateDsl', () => {
  it('registers a source node', () => {
    const code = `const person = source("person", {
      endpoint: "https://swapi.tech/api/people/{id}",
      method: "GET",
      params: { id: 1 }
    });`;
    const registry = evaluateDsl(code);

    expect(registry.nodes).toHaveLength(1);
    expect(registry.nodes[0]).toMatchObject({
      id: 'person',
      type: 'source',
      config: {
        endpoint: 'https://swapi.tech/api/people/{id}',
        method: 'GET',
        params: { id: 1 },
      },
    });
  });

  it('registers chained transform nodes with edges', () => {
    const code = `
      const person = source("person", { endpoint: "https://swapi.tech/api/people/1" });
      const slim = person.select(["name", "height"]);
    `;
    const registry = evaluateDsl(code);

    expect(registry.nodes).toHaveLength(2);
    expect(registry.nodes[1]).toMatchObject({
      id: 'slim',
      type: 'select',
      config: { fields: ['name', 'height'] },
      parentId: 'person',
    });
    expect(registry.edges).toContainEqual({
      source: 'person',
      target: 'slim',
      type: 'chain',
    });
  });

  it('registers ref() as edges', () => {
    const code = `
      const person = source("person", { endpoint: "https://swapi.tech/api/people/1" });
      const films = source("films", { endpoint: ref(person, "films") });
    `;
    const registry = evaluateDsl(code);

    expect(registry.nodes).toHaveLength(2);
    const filmsNode = registry.nodes.find(n => n.id === 'films')!;
    expect(filmsNode.config).toMatchObject({
      endpoint: { __ref: true, nodeId: 'person', field: 'films' },
    });
    expect(registry.edges).toContainEqual({
      source: 'person',
      target: 'films',
      type: 'ref',
    });
  });

  it('registers filter nodes', () => {
    const code = `
      const person = source("person", { endpoint: "https://swapi.tech/api/people/1" });
      const tall = person.filter("height > 180");
    `;
    const registry = evaluateDsl(code);

    expect(registry.nodes[1]).toMatchObject({
      id: 'tall',
      type: 'filter',
      config: { expression: 'height > 180' },
    });
  });

  it('registers map nodes', () => {
    const code = `
      const person = source("person", { endpoint: "https://swapi.tech/api/people/1" });
      const renamed = person.map({ fullName: "name", h: "height" });
    `;
    const registry = evaluateDsl(code);

    expect(registry.nodes[1]).toMatchObject({
      id: 'renamed',
      type: 'map',
      config: { mapping: { fullName: 'name', h: 'height' } },
    });
  });

  it('registers join nodes with as', () => {
    const code = `
      const person = source("person", { endpoint: "https://swapi.tech/api/people/1" });
      const films = source("films", { endpoint: ref(person, "films") });
      const enriched = person.join(films, { as: "films" });
    `;
    const registry = evaluateDsl(code);

    expect(registry.nodes[2]).toMatchObject({
      id: 'enriched',
      type: 'join',
      config: { nodeId: 'films', as: 'films' },
    });
    expect(registry.edges).toContainEqual({
      source: 'films',
      target: 'enriched',
      type: 'join',
    });
  });

  it('registers join nodes with on', () => {
    const code = `
      const a = source("a", { endpoint: "http://example.com/a" });
      const b = source("b", { endpoint: "http://example.com/b" });
      const merged = a.join(b, { on: ["id", "userId"] });
    `;
    const registry = evaluateDsl(code);

    expect(registry.nodes[2]).toMatchObject({
      id: 'merged',
      type: 'join',
      config: { nodeId: 'b', on: ['id', 'userId'] },
    });
  });

  it('handles chained transforms', () => {
    const code = `
      const person = source("person", { endpoint: "https://swapi.tech/api/people/1" });
      const result = person.select(["name", "height"]).filter("height > 100");
    `;
    const registry = evaluateDsl(code);

    expect(registry.nodes).toHaveLength(3);
    expect(registry.nodes[1].type).toBe('select');
    expect(registry.nodes[2].type).toBe('filter');
    expect(registry.nodes[2].parentId).toBe(registry.nodes[1].id);
  });

  it('throws on syntax errors', () => {
    expect(() => evaluateDsl('const = ;')).toThrow();
  });
});
```

- [ ] **Step 2: Install vitest and run tests to verify they fail**

```bash
npm install -D vitest
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

```bash
npx vitest run src/dsl/runtime.test.ts
```

Expected: all tests fail (module not found).

- [ ] **Step 3: Implement the DSL runtime**

```ts
import type { GraphNode, GraphEdge, NodeRegistry, RefValue, SourceConfig, JoinConfig } from '../types';

class NodeProxy {
  constructor(
    private registry: { nodes: GraphNode[]; edges: GraphEdge[] },
    public readonly nodeId: string,
  ) {}

  private addTransform(
    type: GraphNode['type'],
    config: GraphNode['config'],
    explicitId?: string,
  ): NodeProxy {
    const id = explicitId ?? `${this.nodeId}_${type}_${this.registry.nodes.length}`;
    const node: GraphNode = { id, type, config, parentId: this.nodeId };
    this.registry.nodes.push(node);
    this.registry.edges.push({ source: this.nodeId, target: id, type: 'chain' });
    return new NodeProxy(this.registry, id);
  }

  filter(expression: string): NodeProxy {
    return this.addTransform('filter', { expression });
  }

  map(mapping: Record<string, string>): NodeProxy {
    return this.addTransform('map', { mapping });
  }

  select(fields: string[]): NodeProxy {
    return this.addTransform('select', { fields });
  }

  join(other: NodeProxy, options: { as?: string; on?: [string, string] }): NodeProxy {
    const config: JoinConfig = { nodeId: other.nodeId, ...options };
    const proxy = this.addTransform('join', config);
    this.registry.edges.push({ source: other.nodeId, target: proxy.nodeId, type: 'join' });
    return proxy;
  }
}

export function evaluateDsl(code: string): NodeRegistry {
  const registry: { nodes: GraphNode[]; edges: GraphEdge[] } = { nodes: [], edges: [] };

  function source(name: string, config: SourceConfig): NodeProxy {
    const node: GraphNode = { id: name, type: 'source', config };
    registry.nodes.push(node);

    if (config.endpoint && typeof config.endpoint === 'object' && (config.endpoint as RefValue).__ref) {
      const r = config.endpoint as RefValue;
      registry.edges.push({ source: r.nodeId, target: name, type: 'ref' });
    }

    if (config.params) {
      for (const val of Object.values(config.params)) {
        if (val && typeof val === 'object' && (val as RefValue).__ref) {
          const r = val as RefValue;
          registry.edges.push({ source: r.nodeId, target: name, type: 'ref' });
        }
      }
    }

    return new NodeProxy(registry, name);
  }

  function ref(node: NodeProxy, field: string): RefValue {
    return { __ref: true, nodeId: node.nodeId, field };
  }

  const wrappedCode = `
    "use strict";
    ${code}
  `;

  const fn = new Function('source', 'ref', wrappedCode);

  const assignments: Record<string, NodeProxy> = {};
  const handler: ProxyHandler<typeof globalThis> = {
    set(_target, prop, value) {
      if (typeof prop === 'string' && value instanceof NodeProxy) {
        assignments[prop] = value;
      }
      return true;
    },
  };
  const sandbox = new Proxy(Object.create(null), handler);

  try {
    fn.call(sandbox, source, ref);
  } catch (e) {
    throw new Error(`DSL evaluation error: ${(e as Error).message}`);
  }

  resolveVariableNames(registry, code);

  return registry;
}

function resolveVariableNames(registry: { nodes: GraphNode[]; edges: GraphEdge[] }, code: string) {
  const assignmentPattern = /\b(?:const|let|var)\s+(\w+)\s*=/g;
  const varNames: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = assignmentPattern.exec(code)) !== null) {
    varNames.push(match[1]);
  }

  let varIndex = 0;
  for (const node of registry.nodes) {
    if (node.type !== 'source' && node.id.includes('_')) {
      while (varIndex < varNames.length) {
        const name = varNames[varIndex];
        varIndex++;
        const isSourceName = registry.nodes.some(n => n.type === 'source' && n.id === name);
        if (!isSourceName) {
          const oldId = node.id;
          node.id = name;
          for (const edge of registry.edges) {
            if (edge.source === oldId) edge.source = name;
            if (edge.target === oldId) edge.target = name;
          }
          for (const other of registry.nodes) {
            if (other.parentId === oldId) other.parentId = name;
            if (other.type === 'join') {
              const jc = other.config as JoinConfig;
              if (jc.nodeId === oldId) jc.nodeId = name;
            }
          }
          break;
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/dsl/runtime.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/dsl/runtime.ts src/dsl/runtime.test.ts package.json package-lock.json
git commit -m "feat: implement DSL runtime with node/edge registry"
```

---

### Task 4: Execution Engine

**Files:**
- Create: `src/dsl/execute.ts`, `src/dsl/execute.test.ts`

- [ ] **Step 1: Write failing tests for the execution engine**

```ts
import { describe, it, expect, vi } from 'vitest';
import { executePipeline } from './execute';
import type { NodeRegistry, Collection, ExecutionResult } from '../types';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('executePipeline', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('executes a source node and normalizes SWAPI response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        message: 'ok',
        result: {
          properties: { name: 'Luke Skywalker', height: '172' },
        },
      }),
    });

    const registry: NodeRegistry = {
      nodes: [
        { id: 'person', type: 'source', config: { endpoint: 'https://swapi.tech/api/people/1' } },
      ],
      edges: [],
    };

    const results = await executePipeline(registry);
    expect(results.get('person')).toMatchObject({
      status: 'success',
      data: { items: [{ name: 'Luke Skywalker', height: '172' }] },
    });
  });

  it('executes a source node and normalizes array response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
    });

    const registry: NodeRegistry = {
      nodes: [
        { id: 'items', type: 'source', config: { endpoint: 'http://example.com/items' } },
      ],
      edges: [],
    };

    const results = await executePipeline(registry);
    expect(results.get('items')!.data!.items).toHaveLength(2);
  });

  it('executes select transform', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        result: { properties: { name: 'Luke', height: '172', mass: '77', gender: 'male' } },
      }),
    });

    const registry: NodeRegistry = {
      nodes: [
        { id: 'person', type: 'source', config: { endpoint: 'http://example.com/p' } },
        { id: 'slim', type: 'select', config: { fields: ['name', 'height'] }, parentId: 'person' },
      ],
      edges: [{ source: 'person', target: 'slim', type: 'chain' }],
    };

    const results = await executePipeline(registry);
    expect(results.get('slim')!.data!.items[0]).toEqual({ name: 'Luke', height: '172' });
  });

  it('executes filter transform', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        { name: 'Luke', height: 172 },
        { name: 'Yoda', height: 66 },
      ]),
    });

    const registry: NodeRegistry = {
      nodes: [
        { id: 'people', type: 'source', config: { endpoint: 'http://example.com/p' } },
        { id: 'tall', type: 'filter', config: { expression: 'height > 100' }, parentId: 'people' },
      ],
      edges: [{ source: 'people', target: 'tall', type: 'chain' }],
    };

    const results = await executePipeline(registry);
    expect(results.get('tall')!.data!.items).toHaveLength(1);
    expect(results.get('tall')!.data!.items[0].name).toBe('Luke');
  });

  it('executes map transform', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ name: 'Luke', height: '172' }]),
    });

    const registry: NodeRegistry = {
      nodes: [
        { id: 'people', type: 'source', config: { endpoint: 'http://example.com/p' } },
        { id: 'renamed', type: 'map', config: { mapping: { fullName: 'name', h: 'height' } }, parentId: 'people' },
      ],
      edges: [{ source: 'people', target: 'renamed', type: 'chain' }],
    };

    const results = await executePipeline(registry);
    expect(results.get('renamed')!.data!.items[0]).toEqual({ fullName: 'Luke', h: '172' });
  });

  it('executes enrichment join (as)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ name: 'Luke' }]),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ title: 'A New Hope' }, { title: 'Empire Strikes Back' }]),
    });

    const registry: NodeRegistry = {
      nodes: [
        { id: 'person', type: 'source', config: { endpoint: 'http://example.com/person' } },
        { id: 'films', type: 'source', config: { endpoint: 'http://example.com/films' } },
        { id: 'enriched', type: 'join', config: { nodeId: 'films', as: 'films' }, parentId: 'person' },
      ],
      edges: [
        { source: 'person', target: 'enriched', type: 'chain' },
        { source: 'films', target: 'enriched', type: 'join' },
      ],
    };

    const results = await executePipeline(registry);
    const item = results.get('enriched')!.data!.items[0];
    expect(item.name).toBe('Luke');
    expect(item.films).toEqual([{ title: 'A New Hope' }, { title: 'Empire Strikes Back' }]);
  });

  it('resolves ref() in endpoint — single URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        result: { properties: { name: 'Luke', homeworld: 'https://swapi.tech/api/planets/1' } },
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        result: { properties: { name: 'Tatooine', climate: 'arid' } },
      }),
    });

    const registry: NodeRegistry = {
      nodes: [
        { id: 'person', type: 'source', config: { endpoint: 'https://swapi.tech/api/people/1' } },
        { id: 'homeworld', type: 'source', config: { endpoint: { __ref: true, nodeId: 'person', field: 'homeworld' } } },
      ],
      edges: [{ source: 'person', target: 'homeworld', type: 'ref' }],
    };

    const results = await executePipeline(registry);
    expect(results.get('homeworld')!.data!.items[0].name).toBe('Tatooine');
  });

  it('resolves ref() in endpoint — array of URLs', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        result: {
          properties: {
            name: 'Luke',
            films: ['https://swapi.tech/api/films/1', 'https://swapi.tech/api/films/2'],
          },
        },
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: { properties: { title: 'A New Hope' } } }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: { properties: { title: 'Empire Strikes Back' } } }),
    });

    const registry: NodeRegistry = {
      nodes: [
        { id: 'person', type: 'source', config: { endpoint: 'https://swapi.tech/api/people/1' } },
        { id: 'films', type: 'source', config: { endpoint: { __ref: true, nodeId: 'person', field: 'films' } } },
      ],
      edges: [{ source: 'person', target: 'films', type: 'ref' }],
    };

    const results = await executePipeline(registry);
    expect(results.get('films')!.data!.items).toHaveLength(2);
    expect(results.get('films')!.data!.items[0].title).toBe('A New Hope');
  });

  it('propagates errors and stops downstream', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const registry: NodeRegistry = {
      nodes: [
        { id: 'person', type: 'source', config: { endpoint: 'http://example.com/fail' } },
        { id: 'slim', type: 'select', config: { fields: ['name'] }, parentId: 'person' },
      ],
      edges: [{ source: 'person', target: 'slim', type: 'chain' }],
    };

    const results = await executePipeline(registry);
    expect(results.get('person')!.status).toBe('error');
    expect(results.get('slim')!.status).toBe('error');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/dsl/execute.test.ts
```

Expected: all tests fail (module not found).

- [ ] **Step 3: Implement the execution engine**

```ts
import type { NodeRegistry, GraphNode, Collection, ExecutionResult, SourceConfig, FilterConfig, MapConfig, SelectConfig, JoinConfig, RefValue } from '../types';

type ResultMap = Map<string, ExecutionResult>;

export async function executePipeline(
  registry: NodeRegistry,
  onNodeUpdate?: (nodeId: string, result: ExecutionResult) => void,
): Promise<ResultMap> {
  const results: ResultMap = new Map();
  const sorted = topoSort(registry);

  for (const nodeId of sorted) {
    const node = registry.nodes.find(n => n.id === nodeId)!;
    const result = await executeNode(node, registry, results);
    results.set(nodeId, result);
    onNodeUpdate?.(nodeId, result);
  }

  return results;
}

function topoSort(registry: NodeRegistry): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of registry.nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of registry.edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    adjacency.get(edge.source)?.push(edge.target);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  return sorted;
}

async function executeNode(
  node: GraphNode,
  registry: NodeRegistry,
  results: ResultMap,
): Promise<ExecutionResult> {
  const start = performance.now();

  const upstreamFailed = registry.edges
    .filter(e => e.target === node.id)
    .some(e => results.get(e.source)?.status === 'error');

  if (upstreamFailed) {
    return { nodeId: node.id, status: 'error', error: 'Upstream node failed' };
  }

  try {
    let data: Collection;

    switch (node.type) {
      case 'source':
        data = await executeSource(node.config as SourceConfig, results);
        break;
      case 'filter':
        data = executeFilter(node, results);
        break;
      case 'map':
        data = executeMap(node, results);
        break;
      case 'select':
        data = executeSelect(node, results);
        break;
      case 'join':
        data = executeJoin(node, registry, results);
        break;
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }

    return {
      nodeId: node.id,
      status: 'success',
      data,
      durationMs: performance.now() - start,
    };
  } catch (e) {
    return {
      nodeId: node.id,
      status: 'error',
      error: (e as Error).message,
      durationMs: performance.now() - start,
    };
  }
}

async function executeSource(config: SourceConfig, results: ResultMap): Promise<Collection> {
  let endpoint: string | string[];

  if (typeof config.endpoint === 'object' && (config.endpoint as RefValue).__ref) {
    const r = config.endpoint as RefValue;
    const parentResult = results.get(r.nodeId);
    if (!parentResult?.data) throw new Error(`No data from node "${r.nodeId}"`);
    const value = getField(parentResult.data.items[0], r.field);
    endpoint = value as string | string[];
  } else {
    endpoint = config.endpoint as string;
  }

  if (config.params && typeof endpoint === 'string') {
    for (const [key, val] of Object.entries(config.params)) {
      endpoint = endpoint.replace(`{${key}}`, String(val));
    }
  }

  const urls = Array.isArray(endpoint) ? endpoint : [endpoint];
  const queryString = config.query
    ? '?' + new URLSearchParams(config.query as Record<string, string>).toString()
    : '';

  const fetchOptions: RequestInit = { method: config.method ?? 'GET' };
  if (config.body && config.method === 'POST') {
    fetchOptions.headers = { 'Content-Type': 'application/json' };
    fetchOptions.body = JSON.stringify(config.body);
  }

  const responses = await Promise.all(
    urls.map(async (url) => {
      const res = await fetch(url + queryString, fetchOptions);
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      return res.json();
    }),
  );

  const items = responses.flatMap(normalizeResponse);
  return { items };
}

function normalizeResponse(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    if (obj.result && typeof obj.result === 'object') {
      const result = obj.result as Record<string, unknown>;
      if (result.properties && typeof result.properties === 'object') {
        return [result.properties as Record<string, unknown>];
      }
    }
    return [obj];
  }
  return [{ value: data }];
}

function getField(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function getParentData(node: GraphNode, results: ResultMap): Collection {
  if (!node.parentId) throw new Error(`Node "${node.id}" has no parent`);
  const parent = results.get(node.parentId);
  if (!parent?.data) throw new Error(`No data from parent "${node.parentId}"`);
  return parent.data;
}

function executeFilter(node: GraphNode, results: ResultMap): Collection {
  const { expression } = node.config as FilterConfig;
  const input = getParentData(node, results);
  const filterFn = new Function('item', `with(item) { return ${expression}; }`);
  return { items: input.items.filter(item => filterFn(item)) };
}

function executeMap(node: GraphNode, results: ResultMap): Collection {
  const { mapping } = node.config as MapConfig;
  const input = getParentData(node, results);
  return {
    items: input.items.map(item => {
      const result: Record<string, unknown> = {};
      for (const [newKey, sourceKey] of Object.entries(mapping)) {
        result[newKey] = getField(item, sourceKey);
      }
      return result;
    }),
  };
}

function executeSelect(node: GraphNode, results: ResultMap): Collection {
  const { fields } = node.config as SelectConfig;
  const input = getParentData(node, results);
  return {
    items: input.items.map(item => {
      const result: Record<string, unknown> = {};
      for (const field of fields) {
        result[field] = getField(item, field);
      }
      return result;
    }),
  };
}

function executeJoin(node: GraphNode, registry: NodeRegistry, results: ResultMap): Collection {
  const config = node.config as JoinConfig;
  const input = getParentData(node, results);
  const joinSource = results.get(config.nodeId);
  if (!joinSource?.data) throw new Error(`No data from join source "${config.nodeId}"`);

  if (config.as) {
    return {
      items: input.items.map(item => ({
        ...item,
        [config.as!]: joinSource.data!.items,
      })),
    };
  }

  if (config.on) {
    const [leftKey, rightKey] = config.on;
    const rightIndex = new Map<unknown, Record<string, unknown>>();
    for (const rItem of joinSource.data.items) {
      rightIndex.set(getField(rItem, rightKey), rItem);
    }
    return {
      items: input.items
        .map(item => {
          const match = rightIndex.get(getField(item, leftKey));
          return match ? { ...item, ...match } : null;
        })
        .filter((item): item is Record<string, unknown> => item !== null),
    };
  }

  throw new Error('Join requires either "as" or "on" option');
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/dsl/execute.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/dsl/execute.ts src/dsl/execute.test.ts
git commit -m "feat: implement pipeline execution engine"
```

---

### Task 5: Code Generation (Graph → DSL)

**Files:**
- Create: `src/dsl/codegen.ts`, `src/dsl/codegen.test.ts`

- [ ] **Step 1: Write failing tests for code generation**

```ts
import { describe, it, expect } from 'vitest';
import { generateDsl, addNodeToCode, removeNodeFromCode, updateNodeConfigInCode } from './codegen';
import type { NodeRegistry } from '../types';

describe('generateDsl', () => {
  it('generates code for a source node', () => {
    const registry: NodeRegistry = {
      nodes: [
        { id: 'person', type: 'source', config: { endpoint: 'https://swapi.tech/api/people/1', method: 'GET' } },
      ],
      edges: [],
    };

    const code = generateDsl(registry);
    expect(code).toContain('const person = source("person"');
    expect(code).toContain('"https://swapi.tech/api/people/1"');
  });

  it('generates code for chained transforms', () => {
    const registry: NodeRegistry = {
      nodes: [
        { id: 'person', type: 'source', config: { endpoint: 'http://example.com/p' } },
        { id: 'slim', type: 'select', config: { fields: ['name', 'height'] }, parentId: 'person' },
      ],
      edges: [{ source: 'person', target: 'slim', type: 'chain' }],
    };

    const code = generateDsl(registry);
    expect(code).toContain('const slim = person.select(["name", "height"])');
  });

  it('generates code for ref() in endpoint', () => {
    const registry: NodeRegistry = {
      nodes: [
        { id: 'person', type: 'source', config: { endpoint: 'http://example.com/p' } },
        { id: 'films', type: 'source', config: { endpoint: { __ref: true, nodeId: 'person', field: 'films' } } },
      ],
      edges: [{ source: 'person', target: 'films', type: 'ref' }],
    };

    const code = generateDsl(registry);
    expect(code).toContain('ref(person, "films")');
  });

  it('generates code for join with as', () => {
    const registry: NodeRegistry = {
      nodes: [
        { id: 'person', type: 'source', config: { endpoint: 'http://example.com/p' } },
        { id: 'films', type: 'source', config: { endpoint: 'http://example.com/f' } },
        { id: 'enriched', type: 'join', config: { nodeId: 'films', as: 'films' }, parentId: 'person' },
      ],
      edges: [
        { source: 'person', target: 'enriched', type: 'chain' },
        { source: 'films', target: 'enriched', type: 'join' },
      ],
    };

    const code = generateDsl(registry);
    expect(code).toContain('person.join(films, { as: "films" })');
  });
});

describe('addNodeToCode', () => {
  it('appends a new source node', () => {
    const code = 'const person = source("person", { endpoint: "http://example.com/p" });';
    const result = addNodeToCode(code, {
      id: 'films',
      type: 'source',
      config: { endpoint: 'http://example.com/films' },
    });
    expect(result).toContain('const person = source("person"');
    expect(result).toContain('const films = source("films"');
  });

  it('appends a new transform connected to a parent', () => {
    const code = 'const person = source("person", { endpoint: "http://example.com/p" });';
    const result = addNodeToCode(code, {
      id: 'slim',
      type: 'select',
      config: { fields: ['name'] },
      parentId: 'person',
    });
    expect(result).toContain('const slim = person.select(["name"])');
  });
});

describe('removeNodeFromCode', () => {
  it('removes a node declaration', () => {
    const code = `const person = source("person", { endpoint: "http://example.com/p" });
const slim = person.select(["name"]);`;
    const result = removeNodeFromCode(code, 'slim');
    expect(result).toContain('const person');
    expect(result).not.toContain('slim');
  });
});

describe('updateNodeConfigInCode', () => {
  it('updates a source endpoint', () => {
    const code = 'const person = source("person", { endpoint: "http://old.com" });';
    const result = updateNodeConfigInCode(code, 'person', 'endpoint', '"http://new.com"');
    expect(result).toContain('http://new.com');
    expect(result).not.toContain('http://old.com');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/dsl/codegen.test.ts
```

Expected: all tests fail.

- [ ] **Step 3: Implement code generation**

```ts
import * as acorn from 'acorn';
import { generate } from 'astring';
import type { GraphNode, NodeRegistry, RefValue, SourceConfig, FilterConfig, MapConfig, SelectConfig, JoinConfig } from '../types';

export function generateDsl(registry: NodeRegistry): string {
  const lines: string[] = [];
  const sorted = topoSortNodes(registry);

  for (const node of sorted) {
    lines.push(generateNodeLine(node, registry));
  }

  return lines.join('\n\n');
}

function topoSortNodes(registry: NodeRegistry): GraphNode[] {
  const visited = new Set<string>();
  const result: GraphNode[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    for (const edge of registry.edges) {
      if (edge.target === id) visit(edge.source);
    }
    result.push(registry.nodes.find(n => n.id === id)!);
  }

  for (const node of registry.nodes) visit(node.id);
  return result;
}

function generateNodeLine(node: GraphNode, registry: NodeRegistry): string {
  switch (node.type) {
    case 'source':
      return generateSourceLine(node);
    case 'filter':
      return generateFilterLine(node);
    case 'map':
      return generateMapLine(node);
    case 'select':
      return generateSelectLine(node);
    case 'join':
      return generateJoinLine(node);
    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

function generateSourceLine(node: GraphNode): string {
  const config = node.config as SourceConfig;
  const parts: string[] = [];

  if (typeof config.endpoint === 'object' && (config.endpoint as RefValue).__ref) {
    const r = config.endpoint as RefValue;
    parts.push(`endpoint: ref(${r.nodeId}, "${r.field}")`);
  } else {
    parts.push(`endpoint: "${config.endpoint}"`);
  }

  if (config.method && config.method !== 'GET') {
    parts.push(`method: "${config.method}"`);
  }

  if (config.params && Object.keys(config.params).length > 0) {
    parts.push(`params: ${JSON.stringify(config.params)}`);
  }

  if (config.query && Object.keys(config.query).length > 0) {
    parts.push(`query: ${JSON.stringify(config.query)}`);
  }

  if (config.body && Object.keys(config.body).length > 0) {
    parts.push(`body: ${JSON.stringify(config.body)}`);
  }

  return `const ${node.id} = source("${node.id}", { ${parts.join(', ')} });`;
}

function generateFilterLine(node: GraphNode): string {
  const config = node.config as FilterConfig;
  return `const ${node.id} = ${node.parentId}.filter("${config.expression}");`;
}

function generateMapLine(node: GraphNode): string {
  const config = node.config as MapConfig;
  const mappingStr = Object.entries(config.mapping)
    .map(([k, v]) => `${k}: "${v}"`)
    .join(', ');
  return `const ${node.id} = ${node.parentId}.map({ ${mappingStr} });`;
}

function generateSelectLine(node: GraphNode): string {
  const config = node.config as SelectConfig;
  return `const ${node.id} = ${node.parentId}.select(${JSON.stringify(config.fields)});`;
}

function generateJoinLine(node: GraphNode): string {
  const config = node.config as JoinConfig;
  let optStr: string;
  if (config.as) {
    optStr = `{ as: "${config.as}" }`;
  } else if (config.on) {
    optStr = `{ on: ${JSON.stringify(config.on)} }`;
  } else {
    optStr = '{}';
  }
  return `const ${node.id} = ${node.parentId}.join(${config.nodeId}, ${optStr});`;
}

export function addNodeToCode(code: string, node: GraphNode): string {
  const registry: NodeRegistry = { nodes: [node], edges: [] };
  const newLine = generateNodeLine(node, registry);
  return code.trimEnd() + '\n\n' + newLine;
}

export function removeNodeFromCode(code: string, nodeId: string): string {
  const ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: 'module' }) as any;
  const body = ast.body.filter((stmt: any) => {
    if (stmt.type !== 'VariableDeclaration') return true;
    return !stmt.declarations.some((d: any) => d.id?.name === nodeId);
  });
  ast.body = body;
  return generate(ast);
}

export function updateNodeConfigInCode(code: string, nodeId: string, key: string, newValue: string): string {
  const ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: 'module' }) as any;

  for (const stmt of ast.body) {
    if (stmt.type !== 'VariableDeclaration') continue;
    for (const decl of stmt.declarations) {
      if (decl.id?.name !== nodeId) continue;
      const init = decl.init;
      if (!init || init.type !== 'CallExpression') continue;

      const configArg = init.arguments?.[1];
      if (!configArg || configArg.type !== 'ObjectExpression') continue;

      for (const prop of configArg.properties) {
        if (prop.key?.name === key || prop.key?.value === key) {
          const valueAst = acorn.parseExpressionAt(newValue, 0, { ecmaVersion: 2020 }) as any;
          prop.value = valueAst;
          return generate(ast);
        }
      }
    }
  }

  return code;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/dsl/codegen.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/dsl/codegen.ts src/dsl/codegen.test.ts
git commit -m "feat: implement DSL code generation and AST mutations"
```

---

### Task 6: Default Pipeline

**Files:**
- Create: `src/dsl/default-pipeline.ts`

- [ ] **Step 1: Create the default SWAPI pipeline code string**

```ts
export const DEFAULT_PIPELINE = `const person = source("person", {
  endpoint: "https://www.swapi.tech/api/people/{id}",
  method: "GET",
  params: { id: 1 }
});

const films = source("films", {
  endpoint: ref(person, "films"),
  method: "GET"
});

const homeworld = source("homeworld", {
  endpoint: ref(person, "homeworld"),
  method: "GET"
});

const species = source("species", {
  endpoint: ref(person, "species"),
  method: "GET"
});

const starships = source("starships", {
  endpoint: ref(person, "starships"),
  method: "GET"
});

const vehicles = source("vehicles", {
  endpoint: ref(person, "vehicles"),
  method: "GET"
});

const personInfo = person.select(["name", "height", "mass", "birth_year", "gender"]);

const result = personInfo
  .join(films, { as: "films" })
  .join(homeworld, { as: "homeworld" })
  .join(species, { as: "species" })
  .join(starships, { as: "starships" })
  .join(vehicles, { as: "vehicles" });`;
```

- [ ] **Step 2: Commit**

```bash
git add src/dsl/default-pipeline.ts
git commit -m "feat: add default SWAPI pipeline"
```

---

### Task 7: React Flow Custom Nodes

**Files:**
- Create: `src/graph/nodes/SourceNode.tsx`, `src/graph/nodes/SourceNode.module.css`, `src/graph/nodes/TransformNode.tsx`, `src/graph/nodes/TransformNode.module.css`, `src/graph/nodes/nodeTypes.ts`

- [ ] **Step 1: Create SourceNode component**

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { SourceConfig, ExecutionResult, RefValue } from '../../types';
import styles from './SourceNode.module.css';

export interface SourceNodeData {
  label: string;
  config: SourceConfig;
  result?: ExecutionResult;
  onConfigChange?: (key: string, value: string) => void;
}

export function SourceNode({ data }: NodeProps) {
  const { label, config, result, onConfigChange } = data as unknown as SourceNodeData;
  const endpointDisplay = typeof config.endpoint === 'object' && (config.endpoint as RefValue).__ref
    ? `ref(${(config.endpoint as RefValue).nodeId}, "${(config.endpoint as RefValue).field}")`
    : config.endpoint as string;

  return (
    <div className={styles.node}>
      <div className={styles.header}>
        <span className={styles.name}>{label}</span>
        <span className={styles.badge}>SOURCE</span>
      </div>
      <div className={styles.body}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>endpoint</span>
          <input
            className={styles.fieldInput}
            value={endpointDisplay}
            onChange={(e) => onConfigChange?.('endpoint', e.target.value)}
            readOnly={typeof config.endpoint === 'object'}
          />
        </div>
        {config.method && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>method</span>
            <span className={styles.fieldValue}>{config.method}</span>
          </div>
        )}
        {config.params && Object.keys(config.params).length > 0 && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>params</span>
            <span className={styles.fieldValue}>{JSON.stringify(config.params)}</span>
          </div>
        )}
        {result && (
          <div className={styles.result} data-status={result.status}>
            {result.status === 'success' && `✓ ${result.data?.items.length} items · ${Math.round(result.durationMs ?? 0)}ms`}
            {result.status === 'error' && `✗ ${result.error}`}
            {result.status === 'running' && '⟳ running...'}
          </div>
        )}
      </div>
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
}
```

- [ ] **Step 2: Create SourceNode styles**

```css
.node {
  background: #2d2d4a;
  border: 1px solid #5865f2;
  border-radius: 8px;
  min-width: 220px;
  font-size: 13px;
}

.header {
  background: #5865f2;
  color: white;
  padding: 6px 12px;
  border-radius: 7px 7px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.name {
  font-weight: 600;
}

.badge {
  font-size: 10px;
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.body {
  padding: 10px 12px;
}

.field {
  margin-bottom: 6px;
}

.fieldLabel {
  display: block;
  font-size: 11px;
  color: #888;
  margin-bottom: 2px;
}

.fieldInput {
  width: 100%;
  background: #1a1a2e;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  color: #9cdcfe;
  font-family: monospace;
  font-size: 12px;
}

.fieldInput:read-only {
  color: #ce9178;
}

.fieldValue {
  font-family: monospace;
  font-size: 12px;
  color: #9cdcfe;
}

.result {
  font-size: 11px;
  border-top: 1px solid #333;
  padding-top: 6px;
  margin-top: 6px;
}

.result[data-status="success"] {
  color: #43b581;
}

.result[data-status="error"] {
  color: #f04747;
}

.result[data-status="running"] {
  color: #faa61a;
}

.handle {
  width: 8px;
  height: 8px;
  background: #5865f2;
}
```

- [ ] **Step 3: Create TransformNode component**

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { NodeType, FilterConfig, MapConfig, SelectConfig, JoinConfig, ExecutionResult } from '../../types';
import styles from './TransformNode.module.css';

const TYPE_COLORS: Record<string, string> = {
  filter: '#43b581',
  map: '#faa61a',
  select: '#5865f2',
  join: '#f04747',
};

const TYPE_LABELS: Record<string, string> = {
  filter: 'FILTER',
  map: 'MAP',
  select: 'SELECT',
  join: 'JOIN',
};

export interface TransformNodeData {
  label: string;
  nodeType: NodeType;
  config: FilterConfig | MapConfig | SelectConfig | JoinConfig;
  result?: ExecutionResult;
  onConfigChange?: (key: string, value: string) => void;
}

export function TransformNode({ data }: NodeProps) {
  const { label, nodeType, config, result, onConfigChange } = data as unknown as TransformNodeData;
  const color = TYPE_COLORS[nodeType] ?? '#888';

  return (
    <div className={styles.node} style={{ borderColor: color }}>
      <div className={styles.header} style={{ background: color }}>
        <span className={styles.name}>{label}</span>
        <span className={styles.badge}>{TYPE_LABELS[nodeType]}</span>
      </div>
      <div className={styles.body}>
        {nodeType === 'filter' && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>expression</span>
            <input
              className={styles.fieldInput}
              value={(config as FilterConfig).expression}
              onChange={(e) => onConfigChange?.('expression', e.target.value)}
            />
          </div>
        )}
        {nodeType === 'map' && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>mapping</span>
            <span className={styles.fieldValue}>{JSON.stringify((config as MapConfig).mapping)}</span>
          </div>
        )}
        {nodeType === 'select' && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>fields</span>
            <span className={styles.fieldValue}>{(config as SelectConfig).fields.join(', ')}</span>
          </div>
        )}
        {nodeType === 'join' && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              {(config as JoinConfig).as ? 'as' : 'on'}
            </span>
            <span className={styles.fieldValue}>
              {(config as JoinConfig).as ?? JSON.stringify((config as JoinConfig).on)}
            </span>
          </div>
        )}
        {result && (
          <div className={styles.result} data-status={result.status}>
            {result.status === 'success' && `✓ ${result.data?.items.length} items · ${Math.round(result.durationMs ?? 0)}ms`}
            {result.status === 'error' && `✗ ${result.error}`}
            {result.status === 'running' && '⟳ running...'}
          </div>
        )}
      </div>
      <Handle type="target" position={Position.Left} className={styles.handle} style={{ background: color }} />
      <Handle type="source" position={Position.Right} className={styles.handle} style={{ background: color }} />
    </div>
  );
}
```

- [ ] **Step 4: Create TransformNode styles**

```css
.node {
  background: #2d2d4a;
  border: 1px solid;
  border-radius: 8px;
  min-width: 200px;
  font-size: 13px;
}

.header {
  color: white;
  padding: 6px 12px;
  border-radius: 7px 7px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.name {
  font-weight: 600;
}

.badge {
  font-size: 10px;
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.body {
  padding: 10px 12px;
}

.field {
  margin-bottom: 6px;
}

.fieldLabel {
  display: block;
  font-size: 11px;
  color: #888;
  margin-bottom: 2px;
}

.fieldInput {
  width: 100%;
  background: #1a1a2e;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  color: #9cdcfe;
  font-family: monospace;
  font-size: 12px;
}

.fieldValue {
  font-family: monospace;
  font-size: 12px;
  color: #9cdcfe;
}

.result {
  font-size: 11px;
  border-top: 1px solid #333;
  padding-top: 6px;
  margin-top: 6px;
}

.result[data-status="success"] {
  color: #43b581;
}

.result[data-status="error"] {
  color: #f04747;
}

.result[data-status="running"] {
  color: #faa61a;
}

.handle {
  width: 8px;
  height: 8px;
}
```

- [ ] **Step 5: Create nodeTypes registry**

```ts
import { SourceNode } from './SourceNode';
import { TransformNode } from './TransformNode';

export const nodeTypes = {
  source: SourceNode,
  filter: TransformNode,
  map: TransformNode,
  select: TransformNode,
  join: TransformNode,
};
```

- [ ] **Step 6: Verify build succeeds**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/graph/nodes/
git commit -m "feat: add custom React Flow node components"
```

---

### Task 8: DSL → React Flow Bridge

**Files:**
- Create: `src/graph/useGraphFromDsl.ts`

- [ ] **Step 1: Implement the hook that converts DSL code → React Flow nodes/edges**

```ts
import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import Dagre from '@dagrejs/dagre';
import { evaluateDsl } from '../dsl/runtime';
import type { NodeRegistry, ExecutionResult, SourceConfig } from '../types';

export function useGraphFromDsl(
  code: string,
  executionResults?: Map<string, ExecutionResult>,
) {
  return useMemo(() => {
    try {
      const registry = evaluateDsl(code);
      return registryToFlow(registry, executionResults);
    } catch {
      return { nodes: [], edges: [], error: 'DSL parse error' };
    }
  }, [code, executionResults]);
}

export function registryToFlow(
  registry: NodeRegistry,
  executionResults?: Map<string, ExecutionResult>,
): { nodes: Node[]; edges: Edge[]; error?: string } {
  const flowNodes: Node[] = registry.nodes.map((node) => {
    const result = executionResults?.get(node.id);
    const isSource = node.type === 'source';

    return {
      id: node.id,
      type: node.type,
      position: { x: 0, y: 0 },
      data: isSource
        ? { label: node.id, config: node.config, result }
        : { label: node.id, nodeType: node.type, config: node.config, result },
    };
  });

  const flowEdges: Edge[] = registry.edges.map((edge, i) => ({
    id: `e-${edge.source}-${edge.target}-${i}`,
    source: edge.source,
    target: edge.target,
    animated: edge.type === 'ref',
    style: { stroke: edge.type === 'ref' ? '#faa61a' : '#5865f2' },
  }));

  const positioned = applyDagreLayout(flowNodes, flowEdges);

  return { nodes: positioned, edges: flowEdges };
}

function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 120 });

  for (const node of nodes) {
    g.setNode(node.id, { width: 240, height: 120 });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  Dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - 120, y: pos.y - 60 },
    };
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/graph/useGraphFromDsl.ts
git commit -m "feat: add DSL-to-React Flow bridge hook"
```

---

### Task 9: Node Menu + Drag & Drop

**Files:**
- Create: `src/graph/DndContext.tsx`, `src/graph/NodeMenu.tsx`, `src/graph/NodeMenu.module.css`

- [ ] **Step 1: Create DnD context**

```tsx
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
```

- [ ] **Step 2: Create NodeMenu component**

```tsx
import { useDnd } from './DndContext';
import type { NodeType } from '../types';
import styles from './NodeMenu.module.css';

const NODE_ITEMS: { type: NodeType; label: string; color: string }[] = [
  { type: 'source', label: 'Source', color: '#5865f2' },
  { type: 'filter', label: 'Filter', color: '#43b581' },
  { type: 'map', label: 'Map', color: '#faa61a' },
  { type: 'select', label: 'Select', color: '#5865f2' },
  { type: 'join', label: 'Join', color: '#f04747' },
];

export function NodeMenu() {
  const { setDragType } = useDnd();

  function onDragStart(e: React.DragEvent, type: NodeType) {
    setDragType(type);
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div className={styles.menu}>
      <div className={styles.title}>Nodes</div>
      {NODE_ITEMS.map(({ type, label, color }) => (
        <div
          key={type}
          className={styles.item}
          draggable
          onDragStart={(e) => onDragStart(e, type)}
          style={{ borderLeftColor: color }}
        >
          {label}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create NodeMenu styles**

```css
.menu {
  width: 64px;
  background: #13131a;
  border-right: 1px solid #2a2a35;
  padding: 12px 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.title {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #666;
  text-align: center;
  margin-bottom: 4px;
}

.item {
  padding: 8px 6px;
  font-size: 11px;
  color: #ccc;
  background: #1e1e2e;
  border-radius: 4px;
  border-left: 3px solid;
  cursor: grab;
  text-align: center;
  user-select: none;
  transition: background 0.15s;
}

.item:hover {
  background: #2a2a3a;
}

.item:active {
  cursor: grabbing;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/graph/DndContext.tsx src/graph/NodeMenu.tsx src/graph/NodeMenu.module.css
git commit -m "feat: add node menu with drag and drop"
```

---

### Task 10: Graph Canvas

**Files:**
- Create: `src/graph/GraphCanvas.tsx`, `src/graph/GraphCanvas.module.css`, `src/graph/useDslFromGraph.ts`

- [ ] **Step 1: Create the useDslFromGraph hook**

This hook handles graph edits → DSL code mutations.

```ts
import { useCallback } from 'react';
import { addNodeToCode, removeNodeFromCode, updateNodeConfigInCode } from '../dsl/codegen';
import type { GraphNode, NodeType, SourceConfig, FilterConfig, MapConfig, SelectConfig, JoinConfig } from '../types';

function defaultConfig(type: NodeType): GraphNode['config'] {
  switch (type) {
    case 'source':
      return { endpoint: '', method: 'GET' } satisfies SourceConfig;
    case 'filter':
      return { expression: '' } satisfies FilterConfig;
    case 'map':
      return { mapping: {} } satisfies MapConfig;
    case 'select':
      return { fields: [] } satisfies SelectConfig;
    case 'join':
      return { nodeId: '', as: '' } satisfies JoinConfig;
  }
}

export function useDslFromGraph(code: string, onCodeChange: (code: string) => void) {
  const addNode = useCallback(
    (type: NodeType, id: string, parentId?: string) => {
      const node: GraphNode = {
        id,
        type,
        config: defaultConfig(type),
        parentId,
      };
      onCodeChange(addNodeToCode(code, node));
    },
    [code, onCodeChange],
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      onCodeChange(removeNodeFromCode(code, nodeId));
    },
    [code, onCodeChange],
  );

  const updateConfig = useCallback(
    (nodeId: string, key: string, value: string) => {
      onCodeChange(updateNodeConfigInCode(code, nodeId, key, value));
    },
    [code, onCodeChange],
  );

  return { addNode, removeNode, updateConfig };
}
```

- [ ] **Step 2: Create GraphCanvas component**

```tsx
import { useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  type OnConnect,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './nodes/nodeTypes';
import { useDnd } from './DndContext';
import type { NodeType } from '../types';
import type { Node, Edge } from '@xyflow/react';
import styles from './GraphCanvas.module.css';

interface GraphCanvasProps {
  nodes: Node[];
  edges: Edge[];
  code: string;
  onCodeChange: (code: string) => void;
  onNodeSelect?: (nodeId: string | null) => void;
  addNode: (type: NodeType, id: string, parentId?: string) => void;
}

let dropCounter = 0;

export function GraphCanvas({ nodes, edges, code, onCodeChange, onNodeSelect, addNode }: GraphCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const { dragType } = useDnd();

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!dragType) return;

      const id = `${dragType}_${++dropCounter}`;
      addNode(dragType, id);
    },
    [dragType, addNode],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeSelect?.(node.id);
    },
    [onNodeSelect],
  );

  const onPaneClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  return (
    <div className={styles.canvas}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Controls position="bottom-left" />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#333" />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 3: Create GraphCanvas styles**

```css
.canvas {
  flex: 1;
  height: 100%;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/graph/GraphCanvas.tsx src/graph/GraphCanvas.module.css src/graph/useDslFromGraph.ts
git commit -m "feat: add graph canvas with drag-drop and DSL sync"
```

---

### Task 11: Right Panel (DSL Editor + Output Viewer)

**Files:**
- Create: `src/panel/RightPanel.tsx`, `src/panel/RightPanel.module.css`, `src/panel/DslEditor.tsx`, `src/panel/DslEditor.module.css`, `src/panel/OutputViewer.tsx`, `src/panel/OutputViewer.module.css`

- [ ] **Step 1: Create DslEditor component**

```tsx
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import styles from './DslEditor.module.css';

interface DslEditorProps {
  code: string;
  onChange: (code: string) => void;
}

const extensions = [javascript()];

export function DslEditor({ code, onChange }: DslEditorProps) {
  return (
    <div className={styles.editor}>
      <CodeMirror
        value={code}
        onChange={onChange}
        theme={oneDark}
        extensions={extensions}
        height="100%"
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          autocompletion: false,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create DslEditor styles**

```css
.editor {
  flex: 1;
  overflow: hidden;
}

.editor :global(.cm-editor) {
  height: 100%;
}
```

- [ ] **Step 3: Create OutputViewer component**

```tsx
import type { ExecutionResult } from '../types';
import styles from './OutputViewer.module.css';

interface OutputViewerProps {
  selectedNodeId: string | null;
  results: Map<string, ExecutionResult>;
}

export function OutputViewer({ selectedNodeId, results }: OutputViewerProps) {
  if (!selectedNodeId) {
    return (
      <div className={styles.empty}>
        Select a node to view its output
      </div>
    );
  }

  const result = results.get(selectedNodeId);

  if (!result) {
    return (
      <div className={styles.empty}>
        No results yet. Click Run to execute the pipeline.
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div className={styles.error}>
        <div className={styles.errorTitle}>Error in "{selectedNodeId}"</div>
        <pre className={styles.errorMessage}>{result.error}</pre>
      </div>
    );
  }

  if (result.status === 'running') {
    return <div className={styles.empty}>Running...</div>;
  }

  return (
    <div className={styles.output}>
      <div className={styles.header}>
        <span>{selectedNodeId}</span>
        <span className={styles.meta}>
          {result.data?.items.length} items · {Math.round(result.durationMs ?? 0)}ms
        </span>
      </div>
      <pre className={styles.json}>
        {JSON.stringify(result.data, null, 2)}
      </pre>
    </div>
  );
}
```

- [ ] **Step 4: Create OutputViewer styles**

```css
.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 13px;
  padding: 20px;
  text-align: center;
}

.error {
  padding: 16px;
}

.errorTitle {
  color: #f04747;
  font-weight: 600;
  margin-bottom: 8px;
}

.errorMessage {
  color: #f04747;
  font-size: 12px;
  font-family: monospace;
  white-space: pre-wrap;
  background: #1a1a2e;
  padding: 12px;
  border-radius: 4px;
}

.output {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #2a2a35;
  font-size: 13px;
  font-weight: 600;
}

.meta {
  font-weight: 400;
  font-size: 11px;
  color: #43b581;
}

.json {
  flex: 1;
  overflow: auto;
  padding: 12px;
  font-family: monospace;
  font-size: 12px;
  color: #9cdcfe;
  line-height: 1.5;
  white-space: pre-wrap;
  margin: 0;
}
```

- [ ] **Step 5: Create RightPanel component**

```tsx
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
```

- [ ] **Step 6: Create RightPanel styles**

```css
.panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1a1a2e;
}

.tabs {
  display: flex;
  border-bottom: 1px solid #2a2a35;
}

.tab {
  flex: 1;
  padding: 8px;
  background: none;
  border: none;
  color: #666;
  font-size: 12px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: color 0.15s, border-color 0.15s;
  border-bottom: 2px solid transparent;
}

.tab:hover {
  color: #ccc;
}

.active {
  color: #e0e0e0;
  border-bottom-color: #5865f2;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

- [ ] **Step 7: Commit**

```bash
git add src/panel/
git commit -m "feat: add right panel with DSL editor and output viewer"
```

---

### Task 12: Toolbar

**Files:**
- Create: `src/toolbar/Toolbar.tsx`, `src/toolbar/Toolbar.module.css`

- [ ] **Step 1: Create Toolbar component**

```tsx
import styles from './Toolbar.module.css';

interface ToolbarProps {
  onRun: () => void;
  onAutoLayout: () => void;
  onClear: () => void;
  isRunning: boolean;
}

export function Toolbar({ onRun, onAutoLayout, onClear, isRunning }: ToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        <button className={styles.runButton} onClick={onRun} disabled={isRunning}>
          {isRunning ? '⟳ Running...' : '▶ Run'}
        </button>
        <button className={styles.button} onClick={onAutoLayout}>
          Auto-layout
        </button>
        <button className={styles.button} onClick={onClear}>
          Clear
        </button>
      </div>
      <div className={styles.title}>Dataflow DSL</div>
    </div>
  );
}
```

- [ ] **Step 2: Create Toolbar styles**

```css
.toolbar {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #13131a;
  border-bottom: 1px solid #2a2a35;
}

.left {
  display: flex;
  gap: 8px;
}

.button {
  padding: 6px 12px;
  background: #2d2d4a;
  border: 1px solid #3a3a50;
  border-radius: 4px;
  color: #ccc;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.button:hover {
  background: #3a3a55;
}

.runButton {
  padding: 6px 16px;
  background: #43b581;
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.runButton:hover {
  background: #3ca374;
}

.runButton:disabled {
  background: #2d5a44;
  cursor: not-allowed;
}

.title {
  font-size: 14px;
  font-weight: 600;
  color: #888;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/toolbar/
git commit -m "feat: add toolbar with run, auto-layout, and clear buttons"
```

---

### Task 13: Wire Everything Together in App

**Files:**
- Modify: `src/App.tsx`, `src/App.module.css`

- [ ] **Step 1: Wire up App.tsx with all components and state**

```tsx
import { useState, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { DndProvider } from './graph/DndContext';
import { GraphCanvas } from './graph/GraphCanvas';
import { NodeMenu } from './graph/NodeMenu';
import { RightPanel } from './panel/RightPanel';
import { Toolbar } from './toolbar/Toolbar';
import { useGraphFromDsl } from './graph/useGraphFromDsl';
import { useDslFromGraph } from './graph/useDslFromGraph';
import { evaluateDsl } from './dsl/runtime';
import { executePipeline } from './dsl/execute';
import { DEFAULT_PIPELINE } from './dsl/default-pipeline';
import type { ExecutionResult } from './types';
import styles from './App.module.css';

function AppInner() {
  const [code, setCode] = useState(DEFAULT_PIPELINE);
  const [results, setResults] = useState<Map<string, ExecutionResult>>(new Map());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const { nodes, edges, error } = useGraphFromDsl(code, results);
  const { addNode, removeNode, updateConfig } = useDslFromGraph(code, setCode);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setResults(new Map());
    try {
      const registry = evaluateDsl(code);
      const execResults = await executePipeline(registry, (nodeId, result) => {
        setResults(prev => new Map(prev).set(nodeId, result));
      });
      setResults(execResults);
    } catch (e) {
      console.error('Pipeline execution failed:', e);
    } finally {
      setIsRunning(false);
    }
  }, [code]);

  const handleAutoLayout = useCallback(() => {
    setCode(prev => prev + '');
  }, []);

  const handleClear = useCallback(() => {
    setCode('');
    setResults(new Map());
    setSelectedNodeId(null);
  }, []);

  const nodeCount = nodes.length;
  const errorCount = Array.from(results.values()).filter(r => r.status === 'error').length;
  const totalTime = Array.from(results.values()).reduce((sum, r) => sum + (r.durationMs ?? 0), 0);

  return (
    <div className={styles.layout}>
      <Toolbar
        onRun={handleRun}
        onAutoLayout={handleAutoLayout}
        onClear={handleClear}
        isRunning={isRunning}
      />
      <div className={styles.main}>
        <div className={styles.graphArea}>
          <NodeMenu />
          <GraphCanvas
            nodes={nodes}
            edges={edges}
            code={code}
            onCodeChange={setCode}
            onNodeSelect={setSelectedNodeId}
            addNode={addNode}
          />
        </div>
        <div className={styles.panel}>
          <RightPanel
            code={code}
            onCodeChange={setCode}
            selectedNodeId={selectedNodeId}
            results={results}
          />
        </div>
      </div>
      <div className={styles.statusBar}>
        <span>{nodeCount} nodes</span>
        {error && <span className={styles.statusError}>{error}</span>}
        {results.size > 0 && (
          <>
            <span>·</span>
            <span>{Math.round(totalTime)}ms total</span>
            {errorCount > 0 && <span className={styles.statusError}>· {errorCount} errors</span>}
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <DndProvider>
        <AppInner />
      </DndProvider>
    </ReactFlowProvider>
  );
}
```

- [ ] **Step 2: Update App.module.css with status bar error style**

Add to the existing `App.module.css`:

```css
.statusError {
  color: #f04747;
}
```

Also update `.statusBar` to add a gap:

```css
.statusBar {
  height: 28px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  background: #13131a;
  border-top: 1px solid #2a2a35;
  font-size: 12px;
  color: #666;
}
```

- [ ] **Step 3: Verify dev server works end-to-end**

```bash
npm run dev
```

Open in browser. Expected:
- Shell layout visible with dark theme
- React Flow canvas in center with default SWAPI pipeline nodes
- Node menu on the left with 5 draggable node types
- DSL editor on the right showing the default pipeline code
- Run button in toolbar

- [ ] **Step 4: Click Run and verify SWAPI pipeline executes**

Expected: after clicking Run, nodes show loading states, then success with item counts. Select a node and switch to Output tab to see JSON data.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.module.css
git commit -m "feat: wire all components together in App"
```

---

### Task 14: End-to-End Testing in Browser

**Files:** None (manual verification)

- [ ] **Step 1: Test the default pipeline**

Run `npm run dev`, open the browser.

Verify:
1. Default SWAPI pipeline nodes are visible in the graph
2. DSL editor shows the default code
3. Clicking Run executes the pipeline — nodes show success states
4. Selecting a node and clicking Output tab shows JSON data
5. The `result` node (last in chain) shows an enriched person object with films, homeworld, species, starships, vehicles as nested data

- [ ] **Step 2: Test bidirectional sync — DSL → Graph**

In the DSL editor, change `params: { id: 1 }` to `params: { id: 2 }`. Verify the graph updates to reflect the new param.

Add a new line: `const tall = personInfo.filter("height > 100");`. Verify a new filter node appears in the graph.

- [ ] **Step 3: Test drag and drop**

Drag a "Source" node from the menu onto the canvas. Verify a new source node appears. Verify the DSL code updates with a new `const source_N = source(...)` line.

- [ ] **Step 4: Test the Output tab**

Click different nodes and verify the Output tab shows that node's execution result. Verify error states display properly (e.g., change an endpoint to an invalid URL, click Run).

- [ ] **Step 5: Fix any issues found during testing**

Address any bugs found during manual testing steps above.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during e2e testing"
```

---

### Task 15: Build Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Run production build**

```bash
npm run build
```

Expected: successful build.

- [ ] **Step 4: Preview production build**

```bash
npm run preview
```

Open in browser. Verify the app works identically to dev mode.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: verify build and tests pass"
```
