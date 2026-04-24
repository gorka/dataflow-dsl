# API Dataflow DSL + Visual Graph System — Design Spec

## Overview

A system for building, visualizing, and executing API data pipelines. The DSL (valid JavaScript) is the source of truth. A React Flow graph provides a visual editor. Both are bidirectionally synced — edits in either propagate to the other.

The default pipeline uses the Star Wars API (SWAPI) to demonstrate fetching a person, resolving all their URL-referenced data (films, planets, species, starships, vehicles), and producing an enriched output.

## Architecture

```
DSL Code (source of truth)
    │
    ├──► Evaluate ──► Node/Edge Registry ──► React Flow (visualization)
    │
    └──► Execute  ──► Topological sort ──► Fetch/Transform ──► Results
```

### DSL as Source of Truth

The JavaScript DSL code is the canonical representation. It is portable and executable without the UI. The graph is derived from it.

- **DSL → Graph**: Evaluate the DSL in a controlled runtime. Each `source()`, `.filter()`, `.map()`, `.select()`, `.join()` call registers a node. Chaining and `ref()` create edges. React Flow renders the registry.
- **Graph → DSL**: When the user manipulates the graph (add node, connect edge, edit config), the DSL code is modified via AST transforms using acorn (parse) and astring (regenerate).

### Collection-Only Data Model

All data flowing through the system is a collection:

```ts
type Collection<T> = { items: T[] };
```

- Every node outputs a collection
- API responses are normalized: objects become single-element collections, arrays are used directly
- Transforms preserve collection structure — no scalar outputs

## Node Types

Five node types. No special cases.

### Source

Fetches data from an API endpoint. The core node type.

```js
const person = source("person", {
  endpoint: "https://swapi.tech/api/people/{id}",
  method: "GET",
  params: { id: 1 }
});
```

Configuration:
- `endpoint` — URL string (supports `{param}` interpolation) or `ref(node, "field")`
- `method` — `"GET"` or `"POST"` (default: `"GET"`)
- `params` — path parameters interpolated into the URL
- `query` — query string parameters
- `body` — request body (for POST)

All config values can be literals or `ref()` expressions.

When `endpoint` resolves via `ref()`:
- **String URL** → single fetch
- **Array of URLs** → parallel fetch all, return as collection
- **Literal string** → used as-is

### Filter

Filters collection items by a condition expression.

```js
const tall = person.filter("height > 180");
```

- Input: `Collection<T>`
- Output: `Collection<T>` (subset)
- Condition is a string expression evaluated per item

### Map

Transforms/renames fields.

```js
const renamed = person.map({ fullName: "name", h: "height" });
```

- Input: `Collection<T>`
- Output: `Collection<U>`
- Mapping defines output field name → source field path

### Select

Picks specific fields from each item.

```js
const slim = person.select(["name", "height", "mass"]);
```

- Input: `Collection<T>`
- Output: `Collection<Partial<T>>`

### Join

Merges two collections. Two modes:

**Enrichment join** (`as`) — attaches a collection under a key:
```js
const enriched = personInfo.join(films, { as: "films" });
```

**Relational join** (`on`) — matches records by a shared field:
```js
const matched = users.join(orders, { on: ["id", "userId"] });
```

## Reference System

Cross-node dependencies use `ref()`:

```js
ref(node, "field")
```

- Creates a directed edge in the DAG
- Resolved at execution time
- Field path is a string (dot notation for nested: `"result.properties.name"`)

## DSL Runtime

The runtime provides globals (`source`, `ref`) and intercepts method calls (`.filter`, `.map`, `.select`, `.join`) to build a node/edge registry. The DSL code never fetches data — it declares the pipeline structure.

```js
// Runtime globals
function source(name, config) → NodeProxy
function ref(node, field) → Reference

// NodeProxy methods (each returns a new NodeProxy, registering a new node + edge)
.filter(expression) → NodeProxy
.map(mapping) → NodeProxy
.select(fields) → NodeProxy
.join(other, options) → NodeProxy
```

## Execution Engine

Triggered by the Run button:

1. Evaluate DSL → build node/edge registry
2. Topologically sort nodes
3. Execute each node in order:
   - **Source**: HTTP fetch, normalize response into collection
   - **Filter/Map/Select/Join**: operate on input collection(s) in memory
4. Store result per node
5. Update UI: status (loading/success/error), item count, execution time per node
6. Show selected node's output in the Output tab

Errors at a node stop downstream execution. Upstream results are preserved.

SWAPI response normalization: SWAPI wraps data in `{ result: { properties: {...} } }`. The runtime unwraps this.

## UI Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Toolbar: [Run ▶] [Auto-layout] [Clear]            project name │
├────────┬─────────────────────────────────┬──────────────────────┤
│        │                                 │  [DSL] [Output]      │
│ Node   │                                 │                      │
│ Menu   │       React Flow Canvas         │  CodeMirror editor   │
│        │                                 │  or                  │
│ ☐ Src  │   ┌──────┐    ┌──────┐         │  JSON output viewer  │
│ ☐ Fltr │   │person├───►│films │         │                      │
│ ☐ Map  │   └──────┘    └──────┘         │                      │
│ ☐ Slct │                                 │                      │
│ ☐ Join │                                 │                      │
│        │                                 │                      │
├────────┴─────────────────────────────────┴──────────────────────┤
│  Status bar: execution time · node count · errors               │
└──────────────────────────────────────────────────────────────────┘
```

- **Node Menu**: ~60px vertical strip, left side of graph. Draggable node types.
- **Graph Canvas**: remaining ~2/3 width. React Flow with dagre auto-layout.
- **Right Panel**: 1/3 width, tabbed:
  - **DSL tab**: CodeMirror 6 editor with JS syntax highlighting
  - **Output tab**: formatted JSON viewer showing selected node's execution result

### Node Visual Design

Detailed nodes with inline editing (option B from brainstorming):

- Color-coded header showing node name and type badge
- Editable config fields directly in the node (endpoint, params, expression, etc.)
- Execution result summary at bottom (item count, timing, error)
- Input/output handles for edge connections

### Node Menu Behavior

Drag a node type from the menu onto the canvas → creates a new node instance with empty/default config. Connect to existing nodes by dragging between handles. Each graph edit triggers a DSL code update via AST mutation.

## Bidirectional Sync: Graph → DSL

When the user edits the graph, the DSL code is updated:

| Graph action | DSL mutation |
|---|---|
| Drop new source node | Append `const name = source("name", { endpoint: "", method: "GET" })` |
| Drop new transform node + connect | Append `const name = parentNode.filter("")` (or map/select/join) |
| Edit node config in UI | Find AST property node, replace value |
| Connect edge | Modify call chain or insert `ref()` |
| Delete node | Remove `const` declaration and references |
| Rename node | Rename variable declaration and all references |

AST manipulation uses acorn (parse) and astring (regenerate).

## Default SWAPI Pipeline

```js
const person = source("person", {
  endpoint: "https://swapi.tech/api/people/{id}",
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
  .join(vehicles, { as: "vehicles" });
```

## Tech Stack

- **Vite + React + TypeScript**
- **React Flow** — graph rendering and interaction
- **CodeMirror 6** — DSL editor with JS syntax highlighting
- **acorn** — parse DSL to AST
- **astring** — regenerate code from AST
- **dagre** — automatic graph layout
- **CSS Modules** — component styling

No state management library. React state + context. The DSL code string is the single top-level state; graph and output are derived.

## Graph Constraints

- Directed acyclic graph (DAG) — cycles are rejected
- All dependencies are explicit via `ref()` or call chaining
- No hidden or implicit data flow
