import * as acorn from 'acorn';
import { generate } from 'astring';
import type {
  NodeRegistry,
  GraphNode,
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

function serializeValue(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v === null) return 'null';
  if (Array.isArray(v)) return `[${v.map(serializeValue).join(', ')}]`;
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${k}: ${serializeValue(val)}`)
      .join(', ');
    return `{ ${entries} }`;
  }
  return String(v);
}

function serializeEndpoint(endpoint: string | RefValue): string {
  if (isRefValue(endpoint)) {
    return `ref(${endpoint.nodeId}, ${JSON.stringify(endpoint.field)})`;
  }
  return JSON.stringify(endpoint);
}

function generateSourceLine(node: GraphNode): string {
  const config = node.config as SourceConfig;
  const parts: string[] = [`endpoint: ${serializeEndpoint(config.endpoint)}`];

  if (config.method && config.method !== 'GET') {
    parts.push(`method: ${JSON.stringify(config.method)}`);
  }
  if (config.params && Object.keys(config.params).length > 0) {
    parts.push(`params: ${serializeValue(config.params)}`);
  }
  if (config.query && Object.keys(config.query).length > 0) {
    parts.push(`query: ${serializeValue(config.query)}`);
  }
  if (config.body && Object.keys(config.body).length > 0) {
    parts.push(`body: ${serializeValue(config.body)}`);
  }

  return `const ${node.id} = source(${JSON.stringify(node.id)}, { ${parts.join(', ')} });`;
}

function generateTransformLine(node: GraphNode): string {
  const parent = node.parentId!;

  switch (node.type) {
    case 'filter': {
      const { expression } = node.config as FilterConfig;
      return `const ${node.id} = ${parent}.filter(${JSON.stringify(expression)});`;
    }
    case 'map': {
      const { mapping } = node.config as MapConfig;
      const entries = Object.entries(mapping)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(', ');
      return `const ${node.id} = ${parent}.map({ ${entries} });`;
    }
    case 'select': {
      const { fields } = node.config as SelectConfig;
      return `const ${node.id} = ${parent}.select(${serializeValue(fields)});`;
    }
    case 'join': {
      const { nodeId, as, on } = node.config as JoinConfig;
      if (as !== undefined) {
        return `const ${node.id} = ${parent}.join(${nodeId}, { as: ${JSON.stringify(as)} });`;
      }
      if (on !== undefined) {
        return `const ${node.id} = ${parent}.join(${nodeId}, { on: ${serializeValue(on)} });`;
      }
      return `const ${node.id} = ${parent}.join(${nodeId}, {});`;
    }
    default:
      throw new Error(`Unknown node type: ${(node as GraphNode).type}`);
  }
}

function generateNodeLine(node: GraphNode): string {
  if (node.type === 'source') return generateSourceLine(node);
  return generateTransformLine(node);
}

export function generateDsl(registry: NodeRegistry): string {
  const order = topologicalSort(registry);
  const nodeMap = new Map(registry.nodes.map((n) => [n.id, n]));
  return order.map((id) => generateNodeLine(nodeMap.get(id)!)).join('\n');
}

export function addNodeToCode(code: string, node: GraphNode): string {
  const line = generateNodeLine(node);
  return code.trimEnd() + '\n' + line;
}

export function removeNodeFromCode(code: string, nodeId: string): string {
  const ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: 'script' });

  const program = ast as unknown as {
    type: string;
    body: Array<{ type: string; declarations?: Array<{ id: { name: string } }> }>;
  };

  program.body = program.body.filter((stmt) => {
    if (stmt.type !== 'VariableDeclaration') return true;
    const decls = stmt.declarations ?? [];
    return !decls.some((d) => d.id.name === nodeId);
  });

  return generate(ast as Parameters<typeof generate>[0]);
}

export function updateNodeConfigInCode(
  code: string,
  nodeId: string,
  key: string,
  newValue: string,
): string {
  const ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: 'script' });
  const newValueAst = (
    acorn.parse(newValue, { ecmaVersion: 2020, sourceType: 'script' }) as unknown as {
      body: Array<{ expression: unknown }>;
    }
  ).body[0].expression;

  const program = ast as unknown as {
    body: Array<{
      type: string;
      declarations?: Array<{
        id: { name: string };
        init: {
          type: string;
          arguments: Array<{
            type: string;
            properties: Array<{
              key: { type: string; name?: string; value?: string };
              value: unknown;
            }>;
          }>;
        };
      }>;
    }>;
  };

  for (const stmt of program.body) {
    if (stmt.type !== 'VariableDeclaration') continue;
    for (const decl of stmt.declarations ?? []) {
      if (decl.id.name !== nodeId) continue;
      const callArgs = decl.init?.arguments;
      if (!callArgs || callArgs.length < 2) continue;
      const configArg = callArgs[1];
      if (configArg.type !== 'ObjectExpression') continue;
      for (const prop of configArg.properties) {
        const propKey = prop.key.name ?? prop.key.value;
        if (propKey === key) {
          prop.value = newValueAst;
        }
      }
    }
  }

  return generate(ast as Parameters<typeof generate>[0]);
}
