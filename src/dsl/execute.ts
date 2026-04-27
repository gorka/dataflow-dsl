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

interface FetchResult {
  collection: Collection;
  rawResponse: unknown;
}

function validateUrl(url: string): void {
  if (!url || url.trim() === '') {
    throw new Error('Endpoint URL is empty');
  }
  if (/\{(\w+)\}/.test(url)) {
    const unresolved = url.match(/\{(\w+)\}/g)!.join(', ');
    throw new Error(`Endpoint has unresolved placeholders: ${unresolved}`);
  }
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
}

async function fetchUrl(url: string, config: SourceConfig, retries = 2): Promise<FetchResult> {
  validateUrl(url);

  const options: RequestInit = { method: config.method ?? 'GET' };
  if (config.body) {
    options.body = JSON.stringify(config.body);
    options.headers = { 'Content-Type': 'application/json' };
  }
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        throw new Error(`HTTP ${response.status} ${response.statusText} from ${url}`);
      }
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('json')) {
        const preview = (await response.text()).slice(0, 120);
        throw new Error(`Expected JSON response but got ${contentType || 'unknown content type'}: ${preview}...`);
      }
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new Error(`Response from ${url} is not valid JSON`);
      }
      return { collection: normalizeResponse(data), rawResponse: data };
    } catch (err) {
      if (err instanceof TypeError && (err.message === 'Failed to fetch' || err.message.includes('NetworkError'))) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        throw new Error(`Network error: could not reach ${url}`);
      }
      throw err;
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries + 1} attempts`);
}

function resolveParams(
  params: Record<string, unknown>,
  results: Map<string, ExecutionResult>,
): Record<string, unknown>[] {
  const refKeys: { key: string; ref: RefValue }[] = [];
  const plain: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(params)) {
    if (isRefValue(val)) {
      refKeys.push({ key, ref: val });
    } else {
      plain[key] = val;
    }
  }

  if (refKeys.length === 0) return [plain];

  let combos: Record<string, unknown>[] = [{ ...plain }];
  for (const { key, ref } of refKeys) {
    const upstream = results.get(ref.nodeId);
    const items = upstream?.data?.items ?? [];
    const resolved = items.map((item) => getField(item, ref.field)).flat();
    const values = resolved.filter((v) => v != null);

    const next: Record<string, unknown>[] = [];
    for (const combo of combos) {
      for (const val of values) {
        next.push({ ...combo, [key]: val });
      }
    }
    combos = next;
  }

  return combos;
}

interface SourceResult {
  collection: Collection;
  rawResponses: unknown[];
}

async function executeSource(node: GraphNode, results: Map<string, ExecutionResult>): Promise<SourceResult> {
  const config = node.config as SourceConfig;
  const paramSets = resolveParams(config.params ?? {}, results);

  if (paramSets.length === 0) {
    return { collection: { items: [] }, rawResponses: [] };
  }

  if (paramSets.length === 1) {
    const resolved = { ...config, params: paramSets[0] };
    const url = buildUrl(config.endpoint, resolved);
    const result = await fetchUrl(url, resolved);
    return { collection: result.collection, rawResponses: [result.rawResponse] };
  }

  const fetchResults = await Promise.all(
    paramSets.map(async (p) => {
      const resolved = { ...config, params: p };
      const url = buildUrl(config.endpoint, resolved);
      return fetchUrl(url, resolved);
    }),
  );
  return {
    collection: { items: fetchResults.flatMap(r => r.collection.items) },
    rawResponses: fetchResults.map(r => r.rawResponse),
  };
}

export function executeTransform(
  node: GraphNode,
  parentData: Collection,
  results: Map<string, ExecutionResult>,
): Collection {
  switch (node.type) {
    case 'select': {
      const { fields } = node.config as SelectConfig;
      return {
        items: parentData.items.map((item) =>
          Object.fromEntries(fields.map((f) => {
            const parts = f.split('.');
            const key = parts[parts.length - 1];
            return [key, getField(item, f)];
          })),
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
        items: parentData.items.map((item) => {
          const entries: [string, unknown][] = [];
          for (const [newKey, oldKey] of Object.entries(mapping)) {
            if (newKey === '...') {
              const nested = getField(item, oldKey);
              if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
                entries.push(...Object.entries(nested as Record<string, unknown>));
              }
            } else {
              entries.push([newKey, getField(item, oldKey)]);
            }
          }
          return Object.fromEntries(entries);
        }),
      };
    }
    case 'join': {
      const joinConfig = node.config as JoinConfig;
      const rightData = results.get(joinConfig.nodeId)?.data ?? { items: [] };

      if (joinConfig.on !== undefined) {
        const [leftField, rightField] = joinConfig.on;
        const matched: Record<string, unknown>[] = [];
        for (const item of parentData.items) {
          const leftVal = getField(item, leftField);
          const match = rightData.items.find((r) => getField(r, rightField) === leftVal);
          if (match) {
            const merged = joinConfig.as !== undefined
              ? { ...item, [joinConfig.as]: match }
              : { ...item, ...match };
            matched.push(merged);
          }
        }
        return { items: matched };
      }

      if (joinConfig.as !== undefined) {
        return {
          items: parentData.items.map((item) => ({ ...item, [joinConfig.as!]: rightData.items })),
        };
      }

      return parentData;
    }
    default:
      return parentData;
  }
}

export function findConnectedNodes(registry: NodeRegistry): Set<string> {
  const nodeMap = new Map(registry.nodes.map((n) => [n.id, n]));
  const connected = new Set<string>();

  function hasValidChain(id: string, visited: Set<string>): boolean {
    if (visited.has(id)) return false;
    visited.add(id);
    const node = nodeMap.get(id);
    if (!node) return false;
    if (node.type === 'source') return true;
    if (!node.parentId) return false;
    return hasValidChain(node.parentId, visited);
  }

  function markDeps(id: string) {
    if (connected.has(id)) return;
    const node = nodeMap.get(id);
    if (!node) return;
    connected.add(id);
    if (node.parentId) markDeps(node.parentId);
    if (node.type === 'join') {
      const jc = node.config as JoinConfig;
      if (jc.nodeId) markDeps(jc.nodeId);
    }
  }

  for (const node of registry.nodes) {
    if (node.type !== 'source' && hasValidChain(node.id, new Set())) {
      markDeps(node.id);
    }
  }

  if (connected.size === 0) {
    for (const node of registry.nodes) {
      if (node.type === 'source') connected.add(node.id);
    }
  }

  return connected;
}

export function topologicalSort(registry: NodeRegistry): string[] {
  const nodeIds = new Set(registry.nodes.map((n) => n.id));
  const inDegree = new Map<string, number>([...nodeIds].map((id) => [id, 0]));
  const adj = new Map<string, string[]>([...nodeIds].map((id) => [id, []]));

  for (const edge of registry.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    adj.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue = [...nodeIds].filter((id) => inDegree.get(id) === 0);
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

function hasFailedUpstream(nodeId: string, registry: NodeRegistry, results: Map<string, ExecutionResult>): boolean {
  const criticalUpstream = registry.edges
    .filter((e) => e.target === nodeId && e.type !== 'join')
    .map((e) => e.source);
  return criticalUpstream.some((id) => results.get(id)?.status === 'error');
}

export async function executePipeline(
  registry: NodeRegistry,
  onNodeUpdate?: (nodeId: string, result: ExecutionResult) => void,
): Promise<Map<string, ExecutionResult>> {
  const results = new Map<string, ExecutionResult>();
  const connected = findConnectedNodes(registry);
  const order = topologicalSort(registry);
  const nodeMap = new Map(registry.nodes.map((n) => [n.id, n]));

  for (const nodeId of order) {
    const node = nodeMap.get(nodeId)!;

    if (!connected.has(nodeId)) {
      const result: ExecutionResult = { nodeId, status: 'skipped' };
      results.set(nodeId, result);
      onNodeUpdate?.(nodeId, result);
      continue;
    }

    if (hasFailedUpstream(nodeId, registry, results)) {
      const result: ExecutionResult = { nodeId, status: 'error', error: 'Upstream node failed' };
      results.set(nodeId, result);
      onNodeUpdate?.(nodeId, result);
      continue;
    }

    const start = Date.now();

    try {
      let data: Collection;
      let rawResponse: unknown;

      if (node.type === 'source') {
        const sourceResult = await executeSource(node, results);
        data = sourceResult.collection;
        rawResponse = sourceResult.rawResponses.length === 1
          ? sourceResult.rawResponses[0]
          : sourceResult.rawResponses;
      } else {
        const parentId = node.parentId!;
        const parentData = results.get(parentId)?.data ?? { items: [] };
        data = executeTransform(node, parentData, results);
      }

      const result: ExecutionResult = {
        nodeId,
        status: 'success',
        data,
        rawResponse,
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
