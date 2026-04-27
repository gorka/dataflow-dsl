import type {
  NodeRegistry,
  GraphNode,
  GraphEdge,
  SourceConfig,
  RefValue,
} from '../types';

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

export function evaluateDsl(code: string): NodeRegistry {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const source = (name: string, config: SourceConfig): void => {
    if (!name || !config) throw new Error(`source() requires a name and config object`);
    nodes.push({ id: name, type: 'source', config: { ...config, endpoint: config.endpoint ?? '' } });
    for (const refVal of collectRefValues(config)) {
      if (refVal.nodeId) edges.push({ source: refVal.nodeId, target: name, type: 'ref' });
    }
  };

  const filter = (name: string, parent: string, expression: string): void => {
    if (!name) throw new Error(`filter() requires a name`);
    nodes.push({ id: name, type: 'filter', config: { expression: expression ?? '' }, parentId: parent || undefined });
    if (parent) edges.push({ source: parent, target: name, type: 'chain' });
  };

  const map = (name: string, parent: string, mapping: Record<string, string>): void => {
    if (!name) throw new Error(`map() requires a name`);
    nodes.push({ id: name, type: 'map', config: { mapping: mapping ?? {} }, parentId: parent || undefined });
    if (parent) edges.push({ source: parent, target: name, type: 'chain' });
  };

  const select = (name: string, parent: string, fields: string[]): void => {
    if (!name) throw new Error(`select() requires a name`);
    nodes.push({ id: name, type: 'select', config: { fields: Array.isArray(fields) ? fields : [] }, parentId: parent || undefined });
    if (parent) edges.push({ source: parent, target: name, type: 'chain' });
  };

  const join = (name: string, parent: string, other: string, options: { as?: string; on?: [string, string] }): void => {
    if (!name) throw new Error(`join() requires a name`);
    nodes.push({ id: name, type: 'join', config: { nodeId: other ?? '', ...options }, parentId: parent || undefined });
    if (parent) edges.push({ source: parent, target: name, type: 'chain' });
    if (other) edges.push({ source: other, target: name, type: 'join' });
  };

  const ref = (nodeName: string, field: string): RefValue => ({
    __ref: true,
    nodeId: nodeName,
    field,
  });

  let error: string | undefined;

  try {
    const fn = new Function('source', 'filter', 'map', 'select', 'join', 'ref', code);
    fn(source, filter, map, select, join, ref);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (!error) {
    const cycle = detectCycle(edges);
    if (cycle) {
      error = `Circular dependency: ${cycle.join(' → ')}`;
    }
  }

  return { nodes, edges, error };
}

export function detectCycle(edges: GraphEdge[]): string[] | null {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
    if (!adj.has(e.target)) adj.set(e.target, []);
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const node of adj.keys()) color.set(node, WHITE);

  const parent = new Map<string, string>();

  function dfs(node: string): string | null {
    color.set(node, GRAY);
    for (const neighbor of adj.get(node) ?? []) {
      if (color.get(neighbor) === GRAY) {
        const path = [neighbor];
        let cur = node;
        while (cur !== neighbor) {
          path.push(cur);
          cur = parent.get(cur)!;
        }
        path.push(neighbor);
        path.reverse();
        return path.join('\0');
      }
      if (color.get(neighbor) === WHITE) {
        parent.set(neighbor, node);
        const result = dfs(neighbor);
        if (result) return result;
      }
    }
    color.set(node, BLACK);
    return null;
  }

  for (const node of adj.keys()) {
    if (color.get(node) === WHITE) {
      const result = dfs(node);
      if (result) return result.split('\0');
    }
  }
  return null;
}
