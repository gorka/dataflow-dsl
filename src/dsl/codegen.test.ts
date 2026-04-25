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

  it('generates code for ref() in endpoint', () => {
    const registry: NodeRegistry = {
      nodes: [
        { id: 'person', type: 'source', config: { endpoint: '/api/people' } },
        {
          id: 'order',
          type: 'source',
          config: { endpoint: { __ref: true, nodeId: 'person', field: 'id' } },
        },
      ],
      edges: [{ source: 'person', target: 'order', type: 'ref' }],
    };
    const code = generateDsl(registry);
    expect(code).toContain('source("person",');
    expect(code).toContain('ref("person", "id")');
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

  it('ignores unlinked transform node (no parentId)', () => {
    const existing = `source("users", { endpoint: "/api/users" });`;
    const newNode: GraphNode = {
      id: 'filter_1',
      type: 'filter',
      config: { expression: '' },
    };
    const result = addNodeToCode(existing, newNode);
    expect(result).toBe(existing);
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
});
