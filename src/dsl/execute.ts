import type {
  NodeRegistry,
  GraphNode,
  ExecutionResult,
  Collection,
  SourceConfig,
  FilterConfig,
  MapConfig,
  SelectConfig,
  JoinConfig,
  RefValue,
} from '../types';

function isRefValue(v: unknown): v is RefValue {
  return typeof v === 'object' && v !== null && (v as RefValue).__ref === true;
}

function getField(obj: Record<string, unknown>, field: string): unknown {
  const parts = field.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function normalizeResponse(data: unknown): Collection {
  if (Array.isArray(data)) {
    return { items: data as Record<string, unknown>[] };
  }
  if (
    data !== null &&
    typeof data === 'object' &&
    'result' in (data as Record<string, unknown>)
  ) {
    const result = (data as Record<string, unknown>)['result'];
    if (
      result !== null &&
      typeof result === 'object' &&
      'properties' in (result as Record<string, unknown>)
    ) {
      return { items: [(result as Record<string, unknown>)['properties'] as Record<string, unknown>] };
    }
  }
  return { items: [data as Record<string, unknown>] };
}

function interpolateParams(endpoint: string, params: Record<string, unknown>): string {
  return endpoint.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

function buildUrl(endpoint: string, config: SourceConfig): string {
  let url = config.params ? interpolateParams(endpoint, config.params) : endpoint;
  if (config.query && Object.keys(config.query).length > 0) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(config.query).map(([k, v]) => [k, String(v)])),
    ).toString();
    url += (url.includes('?') ? '&' : '?') + qs;
  }
  return url;
}

async function fetchUrl(url: string, config: SourceConfig): Promise<Collection> {
  const options: RequestInit = { method: config.method ?? 'GET' };
  if (config.body) {
    options.body = JSON.stringify(config.body);
    options.headers = { 'Content-Type': 'application/json' };
  }
  const response = await fetch(url, options);
  const data = await response.json();
  return normalizeResponse(data);
}

async function executeSource(node: GraphNode, results: Map<string, ExecutionResult>): Promise<Collection> {
  const config = node.config as SourceConfig;

  if (isRefValue(config.endpoint)) {
    const ref = config.endpoint;
    const upstream = results.get(ref.nodeId);
    const items = upstream?.data?.items ?? [];
    const resolved = items.map((item) => getField(item, ref.field));

    if (resolved.length === 1 && typeof resolved[0] === 'string') {
      const url = buildUrl(resolved[0], config);
      return fetchUrl(url, config);
    }

    const allItems = await Promise.all(
      resolved
        .filter((v): v is string => typeof v === 'string')
        .map(async (u) => {
          const url = buildUrl(u, config);
          const col = await fetchUrl(url, config);
          return col.items;
        }),
    );
    return { items: allItems.flat() };
  }

  const url = buildUrl(config.endpoint, config);
  return fetchUrl(url, config);
}

function executeTransform(
  node: GraphNode,
  parentData: Collection,
  results: Map<string, ExecutionResult>,
): Collection {
  switch (node.type) {
    case 'select': {
      const { fields } = node.config as SelectConfig;
      return {
        items: parentData.items.map((item) =>
          Object.fromEntries(fields.map((f) => [f, getField(item, f)])),
        ),
      };
    }
    case 'filter': {
      const { expression } = node.config as FilterConfig;
      const fn = new Function('item', `with(item) { return ${expression}; }`);
      return { items: parentData.items.filter((item) => fn(item)) };
    }
    case 'map': {
      const { mapping } = node.config as MapConfig;
      return {
        items: parentData.items.map((item) =>
          Object.fromEntries(
            Object.entries(mapping).map(([newKey, oldKey]) => [newKey, getField(item, oldKey)]),
          ),
        ),
      };
    }
    case 'join': {
      const joinConfig = node.config as JoinConfig;
      const rightData = results.get(joinConfig.nodeId)?.data ?? { items: [] };

      if (joinConfig.as !== undefined) {
        return {
          items: parentData.items.map((item) => ({ ...item, [joinConfig.as!]: rightData.items })),
        };
      }

      if (joinConfig.on !== undefined) {
        const [leftField, rightField] = joinConfig.on;
        return {
          items: parentData.items.map((item) => {
            const leftVal = getField(item, leftField);
            const match = rightData.items.find((r) => getField(r, rightField) === leftVal);
            return match ? { ...item, ...match } : { ...item };
          }),
        };
      }

      return parentData;
    }
    default:
      return parentData;
  }
}

function topologicalSort(registry: NodeRegistry): string[] {
  const nodeIds = registry.nodes.map((n) => n.id);
  const inDegree = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  const adj = new Map<string, string[]>(nodeIds.map((id) => [id, []]));

  for (const edge of registry.edges) {
    adj.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue = nodeIds.filter((id) => inDegree.get(id) === 0);
  const order: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    for (const neighbor of adj.get(current) ?? []) {
      const deg = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    }
  }

  return order;
}

function getUpstreamIds(nodeId: string, registry: NodeRegistry): string[] {
  return registry.edges.filter((e) => e.target === nodeId).map((e) => e.source);
}

function hasFailedUpstream(nodeId: string, registry: NodeRegistry, results: Map<string, ExecutionResult>): boolean {
  return getUpstreamIds(nodeId, registry).some((id) => {
    const r = results.get(id);
    return r?.status === 'error';
  });
}

export async function executePipeline(
  registry: NodeRegistry,
  onNodeUpdate?: (nodeId: string, result: ExecutionResult) => void,
): Promise<Map<string, ExecutionResult>> {
  const results = new Map<string, ExecutionResult>();
  const order = topologicalSort(registry);
  const nodeMap = new Map(registry.nodes.map((n) => [n.id, n]));

  for (const nodeId of order) {
    const node = nodeMap.get(nodeId)!;

    if (hasFailedUpstream(nodeId, registry, results)) {
      const result: ExecutionResult = { nodeId, status: 'error', error: 'Upstream node failed' };
      results.set(nodeId, result);
      onNodeUpdate?.(nodeId, result);
      continue;
    }

    const start = Date.now();

    try {
      let data: Collection;

      if (node.type === 'source') {
        data = await executeSource(node, results);
      } else {
        const parentId = node.parentId!;
        const parentData = results.get(parentId)?.data ?? { items: [] };
        data = executeTransform(node, parentData, results);
      }

      const result: ExecutionResult = {
        nodeId,
        status: 'success',
        data,
        durationMs: Date.now() - start,
      };
      results.set(nodeId, result);
      onNodeUpdate?.(nodeId, result);
    } catch (err) {
      const result: ExecutionResult = {
        nodeId,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
      results.set(nodeId, result);
      onNodeUpdate?.(nodeId, result);
    }
  }

  return results;
}
