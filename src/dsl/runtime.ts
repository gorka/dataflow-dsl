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
    if (!name || !config?.endpoint) throw new Error(`source() requires a name and config with endpoint`);
    nodes.push({ id: name, type: 'source', config });
    for (const refVal of collectRefValues(config)) {
      edges.push({ source: refVal.nodeId, target: name, type: 'ref' });
    }
  };

  const filter = (name: string, parent: string, expression: string): void => {
    if (!name || !parent || expression == null) throw new Error(`filter() requires name, parent, and expression`);
    nodes.push({ id: name, type: 'filter', config: { expression }, parentId: parent });
    edges.push({ source: parent, target: name, type: 'chain' });
  };

  const map = (name: string, parent: string, mapping: Record<string, string>): void => {
    if (!name || !parent || !mapping) throw new Error(`map() requires name, parent, and mapping`);
    nodes.push({ id: name, type: 'map', config: { mapping }, parentId: parent });
    edges.push({ source: parent, target: name, type: 'chain' });
  };

  const select = (name: string, parent: string, fields: string[]): void => {
    if (!name || !parent || !Array.isArray(fields)) throw new Error(`select() requires name, parent, and fields array`);
    nodes.push({ id: name, type: 'select', config: { fields }, parentId: parent });
    edges.push({ source: parent, target: name, type: 'chain' });
  };

  const join = (name: string, parent: string, other: string, options: { as?: string; on?: [string, string] }): void => {
    if (!name || !parent || !other) throw new Error(`join() requires name, parent, and other node`);
    nodes.push({ id: name, type: 'join', config: { nodeId: other, ...options }, parentId: parent });
    edges.push({ source: parent, target: name, type: 'chain' });
    edges.push({ source: other, target: name, type: 'join' });
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

  return { nodes, edges, error };
}
