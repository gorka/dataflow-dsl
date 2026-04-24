import * as acorn from 'acorn';
import { generate } from 'astring';
import type {
  NodeRegistry,
  GraphNode,
  GraphEdge,
  SourceConfig,
  FilterConfig,
  MapConfig,
  SelectConfig,
  JoinConfig,
  RefValue,
} from '../types';

class NodeProxy {
  nodeId: string;
  private _nodes: GraphNode[];
  private _edges: GraphEdge[];

  constructor(nodeId: string, nodes: GraphNode[], edges: GraphEdge[]) {
    this.nodeId = nodeId;
    this._nodes = nodes;
    this._edges = edges;
  }

  filter(expression: string): NodeProxy {
    const id = nextId(this._nodes);
    this._nodes.push({
      id,
      type: 'filter',
      config: { expression } satisfies FilterConfig,
      parentId: this.nodeId,
    });
    this._edges.push({ source: this.nodeId, target: id, type: 'chain' });
    return new NodeProxy(id, this._nodes, this._edges);
  }

  map(mapping: Record<string, string>): NodeProxy {
    const id = nextId(this._nodes);
    this._nodes.push({
      id,
      type: 'map',
      config: { mapping } satisfies MapConfig,
      parentId: this.nodeId,
    });
    this._edges.push({ source: this.nodeId, target: id, type: 'chain' });
    return new NodeProxy(id, this._nodes, this._edges);
  }

  select(fields: string[]): NodeProxy {
    const id = nextId(this._nodes);
    this._nodes.push({
      id,
      type: 'select',
      config: { fields } satisfies SelectConfig,
      parentId: this.nodeId,
    });
    this._edges.push({ source: this.nodeId, target: id, type: 'chain' });
    return new NodeProxy(id, this._nodes, this._edges);
  }

  join(other: NodeProxy, options: { as?: string; on?: [string, string] }): NodeProxy {
    const id = nextId(this._nodes);
    const config: JoinConfig = { nodeId: other.nodeId, ...options };
    this._nodes.push({
      id,
      type: 'join',
      config,
      parentId: this.nodeId,
    });
    this._edges.push({ source: this.nodeId, target: id, type: 'chain' });
    this._edges.push({ source: other.nodeId, target: id, type: 'join' });
    return new NodeProxy(id, this._nodes, this._edges);
  }
}

function nextId(nodes: GraphNode[]): string {
  return `__node_${nodes.length}`;
}

function transformAst(ast: acorn.Program): string {
  const program = ast as unknown as {
    type: string;
    body: Array<Record<string, unknown>>;
  };

  for (const statement of program.body) {
    if (statement['type'] !== 'VariableDeclaration') continue;

    const declarations = statement['declarations'] as Array<{
      type: string;
      id: { name: string };
      init: unknown;
    }>;

    for (const decl of declarations) {
      if (!decl.init) continue;
      const varName = decl.id.name;
      decl.init = {
        type: 'AssignmentExpression',
        operator: '=',
        left: {
          type: 'MemberExpression',
          object: { type: 'Identifier', name: '__scope' },
          property: { type: 'Identifier', name: varName },
          computed: false,
          optional: false,
        },
        right: decl.init,
      };
    }
  }

  return generate(ast as Parameters<typeof generate>[0]);
}

function collectRefValues(obj: unknown): RefValue[] {
  if (!obj || typeof obj !== 'object') return [];
  const result: RefValue[] = [];
  for (const val of Object.values(obj as Record<string, unknown>)) {
    if (val && typeof val === 'object' && (val as RefValue).__ref === true) {
      result.push(val as RefValue);
    } else {
      result.push(...collectRefValues(val));
    }
  }
  return result;
}

function renameNode(nodes: GraphNode[], edges: GraphEdge[], oldId: string, newId: string): void {
  for (const node of nodes) {
    if (node.id === oldId) node.id = newId;
    if (node.parentId === oldId) node.parentId = newId;
    if (node.type === 'join') {
      const config = node.config as JoinConfig;
      if (config.nodeId === oldId) config.nodeId = newId;
    }
  }
  for (const edge of edges) {
    if (edge.source === oldId) edge.source = newId;
    if (edge.target === oldId) edge.target = newId;
  }
}

export function evaluateDsl(code: string): NodeRegistry {
  const ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: 'script' });

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const source = (name: string, config: SourceConfig): NodeProxy => {
    nodes.push({ id: name, type: 'source', config });
    for (const refVal of collectRefValues(config)) {
      edges.push({ source: refVal.nodeId, target: name, type: 'ref' });
    }
    return new NodeProxy(name, nodes, edges);
  };

  const ref = (proxy: NodeProxy, field: string): RefValue => ({
    __ref: true,
    nodeId: proxy.nodeId,
    field,
  });

  const transformedCode = transformAst(ast);
  const __scope: Record<string, unknown> = {};

  const fn = new Function('source', 'ref', '__scope', transformedCode);
  fn(source, ref, __scope);

  for (const [varName, value] of Object.entries(__scope)) {
    if (!(value instanceof NodeProxy)) continue;
    const node = nodes.find((n) => n.id === value.nodeId);
    if (!node || node.type === 'source') continue;
    const oldId = value.nodeId;
    if (oldId !== varName) {
      renameNode(nodes, edges, oldId, varName);
      value.nodeId = varName;
    }
  }

  return { nodes, edges };
}
