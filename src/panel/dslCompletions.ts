import { autocompletion, snippet, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';
import type { ExecutionResult, GraphEdge } from '../types';

const DSL_FUNCTIONS = [
  {
    label: 'source',
    detail: '(name, { endpoint, method?, params? })',
    apply: snippet('source("${name}", {\n  endpoint: "${url}"\n});\n'),
  },
  {
    label: 'filter',
    detail: '(name, parent, expression)',
    apply: snippet('filter("${name}", "${parent}", "${expression}");\n'),
  },
  {
    label: 'map',
    detail: '(name, parent, { newKey: "oldKey" })',
    apply: snippet('map("${name}", "${parent}", { ${key}: "${field}" });\n'),
  },
  {
    label: 'select',
    detail: '(name, parent, ["field1", "field2"])',
    apply: snippet('select("${name}", "${parent}", ["${field}"]);\n'),
  },
  {
    label: 'join',
    detail: '(name, parent, other, { as: "key" })',
    apply: snippet('join("${name}", "${parent}", "${other}", { as: "${key}" });\n'),
  },
  {
    label: 'ref',
    detail: '(nodeId, "field.path")',
    apply: snippet('ref("${nodeId}", "${field}")'),
  },
];

const PARENT_ARG_FUNCS = new Set(['filter', 'map', 'select']);

const CONFIG_KEYS: Record<string, { label: string; detail: string }[]> = {
  source: [
    { label: 'endpoint', detail: 'string — URL template' },
    { label: 'method', detail: '"GET" | "POST"' },
    { label: 'params', detail: '{ key: value }' },
    { label: 'query', detail: '{ key: value }' },
    { label: 'body', detail: '{ key: value }' },
  ],
  join: [
    { label: 'as', detail: 'string — nest joined data under this key' },
    { label: 'on', detail: '["localField", "remoteField"]' },
  ],
};

function collectPaths(obj: unknown, prefix: string, maxDepth: number): string[] {
  if (maxDepth <= 0 || obj == null || typeof obj !== 'object') return [];
  const paths: string[] = [];
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.push(path);
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      paths.push(...collectPaths(val, path, maxDepth - 1));
    }
  }
  return paths;
}

function getFieldPaths(results: Map<string, ExecutionResult>, nodeId: string): string[] {
  const result = results.get(nodeId);
  if (!result?.data?.items?.length) return [];
  return collectPaths(result.data.items[0], '', 4);
}

function findStringContext(text: string, pos: number): { start: number; content: string } | null {
  let i = pos - 1;
  while (i >= 0 && text[i] !== '"') {
    if (text[i] === '\n') return null;
    i--;
  }
  if (i < 0 || text[i] !== '"') return null;
  return { start: i + 1, content: text.slice(i + 1, pos) };
}

interface CallContext {
  func: string;
  argIndex: number;
  args: string[];
}

function parseCallContext(text: string, pos: number): CallContext | null {
  let depth = 0;
  let argIndex = 0;
  const argStarts: number[] = [];
  let parenStart = -1;

  for (let i = pos - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === ')' || ch === ']' || ch === '}') depth++;
    else if (ch === '(' || ch === '[' || ch === '{') {
      if (depth > 0) { depth--; continue; }
      if (ch === '(') { parenStart = i; break; }
      return null;
    } else if (ch === ',' && depth === 0) {
      argIndex++;
      argStarts.push(i);
    }
  }

  if (parenStart < 0) return null;

  const before = text.slice(0, parenStart);
  const funcMatch = /(\w+)\s*$/.exec(before);
  if (!funcMatch) return null;

  const argsText = text.slice(parenStart + 1, pos);
  const args = argsText.split(',').map(a => {
    const m = /"([^"]*)"/.exec(a.trim());
    return m ? m[1] : '';
  });

  return { func: funcMatch[1], argIndex, args };
}

function findObjectContext(doc: string, pos: number): { func: string; wordFrom: number } | null {
  let depth = 0;
  let braceStart = -1;

  for (let i = pos - 1; i >= 0; i--) {
    const ch = doc[i];
    if (ch === '}' || ch === ')' || ch === ']') depth++;
    else if (ch === '{') {
      if (depth > 0) { depth--; continue; }
      braceStart = i;
      break;
    } else if ((ch === '(' || ch === '[') && depth === 0) return null;
  }
  if (braceStart < 0) return null;

  const callCtx = parseCallContext(doc, braceStart);
  if (!callCtx) return null;

  const word = /\w*$/.exec(doc.slice(0, pos));
  const wordFrom = word ? pos - word[0].length : pos;

  return { func: callCtx.func, wordFrom };
}

function findEnclosingSourceNode(text: string, pos: number): string | null {
  const sourceRe = /source\s*\(\s*"([^"]+)"/g;
  let best: { name: string; start: number } | null = null;
  let match;
  while ((match = sourceRe.exec(text)) !== null) {
    if (match.index > pos) break;
    let depth = 0;
    let end = text.length;
    for (let i = match.index; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') depth--;
      if (depth <= 0) { end = i; break; }
    }
    if (pos >= match.index && pos <= end) {
      best = { name: match[1], start: match.index };
    }
  }
  return best?.name ?? null;
}

function getDescendants(nodeId: string, edges: GraphEdge[]): Set<string> {
  const visited = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const e of edges) {
      if (e.source === current && !visited.has(e.target)) {
        queue.push(e.target);
      }
    }
  }
  return visited;
}

function dslCompletionSource(
  nodeIds: string[],
  results: Map<string, ExecutionResult>,
  edges: GraphEdge[],
) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const { state, pos } = ctx;
    const doc = state.doc.toString();

    const strCtx = findStringContext(doc, pos);
    if (strCtx) {
      const callCtx = parseCallContext(doc, strCtx.start - 1);
      if (!callCtx) return null;

      if (callCtx.func === 'ref' && callCtx.argIndex === 0) {
        const enclosing = findEnclosingSourceNode(doc, pos);
        const excluded = enclosing ? getDescendants(enclosing, edges) : new Set<string>();
        const available = nodeIds.filter(id => !excluded.has(id));
        return {
          from: strCtx.start,
          options: available.map(id => ({ label: id, type: 'variable' })),
        };
      }

      if (PARENT_ARG_FUNCS.has(callCtx.func) && callCtx.argIndex === 1) {
        return {
          from: strCtx.start,
          options: nodeIds.map(id => ({ label: id, type: 'variable' })),
        };
      }

      if (callCtx.func === 'ref' && callCtx.argIndex === 1 && callCtx.args[0]) {
        const paths = getFieldPaths(results, callCtx.args[0]);
        if (paths.length === 0) return null;
        return {
          from: strCtx.start,
          options: paths.map(p => ({ label: p, type: 'property' })),
        };
      }

      if (callCtx.func === 'select' && callCtx.argIndex >= 2 && callCtx.args[1]) {
        const paths = getFieldPaths(results, callCtx.args[1]);
        if (paths.length === 0) return null;
        return {
          from: strCtx.start,
          options: paths.map(p => ({ label: p, type: 'property' })),
        };
      }

      return null;
    }

    const objCtx = findObjectContext(doc, pos);
    if (objCtx && CONFIG_KEYS[objCtx.func]) {
      return {
        from: objCtx.wordFrom,
        options: CONFIG_KEYS[objCtx.func].map(k => ({
          label: k.label,
          detail: k.detail,
          type: 'property',
          apply: k.label + ': ',
        })),
      };
    }

    const word = ctx.matchBefore(/\w+/);
    if (!word) return null;

    return {
      from: word.from,
      options: DSL_FUNCTIONS.map(f => ({ ...f, type: 'function' })),
    };
  };
}

export function createDslCompletion(
  nodeIds: string[],
  results: Map<string, ExecutionResult>,
  edges: GraphEdge[] = [],
): Extension {
  return autocompletion({
    override: [dslCompletionSource(nodeIds, results, edges)],
    activateOnTyping: true,
  });
}
