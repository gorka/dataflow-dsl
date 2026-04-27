import { describe, it, expect } from 'vitest';
import { generateDsl, addNodeToCode, removeNodeFromCode, updateNodeConfigInCode } from './codegen';
import { evaluateDsl } from './runtime';
import type { NodeRegistry, GraphNode } from '../types';

describe('generateDsl', () => {
  it('generates code for a source node with endpoint and method', () => {
    const registry: NodeRegistry = {
      nodes: [
        {
          id: 'users',
          type: 'source',
          config: { endpoint: '/api/users', method: 'POST', body: { active: true } },
        },
      ],
      edges: [],
    };
    const code = generateDsl(registry);
    expect(code).toContain('source("users",');
    expect(code).toContain('method: "POST"');
    expect(code).toContain('endpoint: "/api/users"');
  });

  it('generates code for a select transform', () => {
    const registry: NodeRegistry = {
      nodes: [
        { id: 'people', type: 'source', config: { endpoint: '/api/people' } },
        { id: 'slim', type: 'select', config: { fields: ['name', 'age'] }, parentId: 'people' },
      ],
      edges: [{ source: 'people', target: 'slim', type: 'chain' }],
    };
    const code = generateDsl(registry);
    expect(code).toContain('source("people",');
    expect(code).toContain('select("slim", "people",');
    expect(code).toContain('"name"');
    expect(code).toContain('"age"');
  });

  it('generates code for ref() in params', () => {
    const registry: NodeRegistry = {
      nodes: [
        { id: 'person', type: 'source', config: { endpoint: '/api/people' } },
        {
          id: 'order',
          type: 'source',
          config: {
            endpoint: '{url}',
            params: { url: { __ref: true, nodeId: 'person', field: 'profileUrl' } },
          },
        },
      ],
      edges: [{ source: 'person', target: 'order', type: 'ref' }],
    };
    const code = generateDsl(registry);
    expect(code).toContain('source("person",');
    expect(code).toContain('ref("person", "profileUrl")');
  });

  it('generates code for join', () => {
    const registry: NodeRegistry = {
      nodes: [
        { id: 'person', type: 'source', config: { endpoint: '/api/people' } },
        { id: 'order', type: 'source', config: { endpoint: '/api/orders' } },
        {
          id: 'enriched',
          type: 'join',
          config: { nodeId: 'order', as: 'orders' },
          parentId: 'person',
        },
      ],
      edges: [
        { source: 'person', target: 'enriched', type: 'chain' },
        { source: 'order', target: 'enriched', type: 'join' },
      ],
    };
    const code = generateDsl(registry);
    expect(code).toContain('join("enriched", "person", "order",');
    expect(code).toContain('as: "orders"');
  });

  it('roundtrips through evaluateDsl for a select', () => {
    const original = `source("people", { endpoint: "/api/people" });
select("slim", "people", ["name", "age"]);`;
    const registry = evaluateDsl(original);
    const code = generateDsl(registry);
    const registry2 = evaluateDsl(code);
    expect(registry2.nodes).toHaveLength(registry.nodes.length);
    expect(registry2.nodes.find((n) => n.id === 'people')).toBeDefined();
    expect(registry2.nodes.find((n) => n.id === 'slim')).toBeDefined();
  });
});

describe('addNodeToCode', () => {
  it('appends a source node', () => {
    const existing = `source("users", { endpoint: "/api/users" });`;
    const newNode: GraphNode = {
      id: 'posts',
      type: 'source',
      config: { endpoint: '/api/posts' },
    };
    const result = addNodeToCode(existing, newNode);
    expect(result).toContain('source("users",');
    expect(result).toContain('source("posts",');
  });

  it('appends unlinked transform node with empty parent', () => {
    const existing = `source("users", { endpoint: "/api/users" });`;
    const newNode: GraphNode = {
      id: 'filter_1',
      type: 'filter',
      config: { expression: '' },
    };
    const result = addNodeToCode(existing, newNode);
    expect(result).toContain('filter("filter_1", "", "")');
  });

  it('appends a transform connected to parent', () => {
    const existing = `source("users", { endpoint: "/api/users" });`;
    const newNode: GraphNode = {
      id: 'slim',
      type: 'select',
      config: { fields: ['name', 'email'] },
      parentId: 'users',
    };
    const result = addNodeToCode(existing, newNode);
    expect(result).toContain('select("slim", "users",');
    expect(result).toContain('"name"');
    expect(result).toContain('"email"');
  });
});

describe('removeNodeFromCode', () => {
  it('removes a node by name', () => {
    const code = `source("users", { endpoint: "/api/users" });
select("slim", "users", ["name", "age"]);`;
    const result = removeNodeFromCode(code, 'users');
    expect(result).not.toContain('source("users"');
    expect(result).toContain('select("slim"');
  });
});

describe('updateNodeConfigInCode', () => {
  it('updates a source endpoint', () => {
    const code = `source("users", { endpoint: "/api/users" });`;
    const result = updateNodeConfigInCode(code, 'users', 'endpoint', '"/api/v2/users"');
    expect(result).toContain('/api/v2/users');
    expect(result).not.toContain('/api/users"');
  });

  it('updates __parent of a transform node', () => {
    const code = `source("api", { endpoint: "/api" });\nfilter("f1", "", "x > 1");`;
    const result = updateNodeConfigInCode(code, 'f1', '__parent', '"api"');
    expect(result).toContain('filter("f1", "api", "x > 1")');
  });

  it('clears __parent of a transform node', () => {
    const code = `filter("f1", "api", "x > 1");`;
    const result = updateNodeConfigInCode(code, 'f1', '__parent', '""');
    expect(result).toContain('filter("f1", "", "x > 1")');
  });

  it('adds a new property to source config', () => {
    const code = `source("api", { endpoint: "/api/users/{id}" });`;
    const result = updateNodeConfigInCode(code, 'api', 'params', '{ id: "" }');
    expect(result).toContain('params');
    expect(result).toContain('id');
    const registry = evaluateDsl(result);
    expect(registry.nodes[0].config).toHaveProperty('params');
  });
});

describe('removeNodeFromCode — orphans', () => {
  it('removes multiple orphan nodes', () => {
    const code = `source("api", { endpoint: "/url" });\nfilter("f1", "", "x > 1");\nmap("m1", "", { a: "b" });`;
    let result = removeNodeFromCode(code, 'f1');
    result = removeNodeFromCode(result, 'm1');
    expect(result).toContain('source("api"');
    expect(result).not.toContain('filter("f1"');
    expect(result).not.toContain('map("m1"');
  });
});
