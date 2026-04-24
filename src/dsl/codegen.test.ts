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
    expect(code).toContain('const users = source("users",');
    expect(code).toContain('method: "POST"');
    expect(code).toContain('endpoint: "/api/users"');
  });

  it('generates code for chained transforms (select)', () => {
    const registry: NodeRegistry = {
      nodes: [
        { id: 'people', type: 'source', config: { endpoint: '/api/people' } },
        { id: 'slim', type: 'select', config: { fields: ['name', 'age'] }, parentId: 'people' },
      ],
      edges: [{ source: 'people', target: 'slim', type: 'chain' }],
    };
    const code = generateDsl(registry);
    expect(code).toContain('const people = source("people",');
    expect(code).toContain('const slim = people.select(');
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
    expect(code).toContain('const person = source("person",');
    expect(code).toContain('endpoint: ref(person, "id")');
  });

  it('generates code for join with as', () => {
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
    expect(code).toContain('const enriched = person.join(order,');
    expect(code).toContain('as: "orders"');
  });

  it('roundtrips through evaluateDsl for a select chain', () => {
    const original = `const people = source("people", { endpoint: "/api/people" });
const slim = people.select(["name", "age"]);`;
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
    const existing = `const users = source("users", { endpoint: "/api/users" });`;
    const newNode: GraphNode = {
      id: 'posts',
      type: 'source',
      config: { endpoint: '/api/posts' },
    };
    const result = addNodeToCode(existing, newNode);
    expect(result).toContain('const users =');
    expect(result).toContain('const posts = source("posts",');
  });

  it('appends a transform connected to parent', () => {
    const existing = `const users = source("users", { endpoint: "/api/users" });`;
    const newNode: GraphNode = {
      id: 'slim',
      type: 'select',
      config: { fields: ['name', 'email'] },
      parentId: 'users',
    };
    const result = addNodeToCode(existing, newNode);
    expect(result).toContain('const slim = users.select(');
    expect(result).toContain('"name"');
    expect(result).toContain('"email"');
  });
});

describe('removeNodeFromCode', () => {
  it('removes a node declaration', () => {
    const code = `const users = source("users", { endpoint: "/api/users" });
const slim = users.select(["name", "age"]);`;
    const result = removeNodeFromCode(code, 'users');
    expect(result).not.toContain('const users');
    expect(result).toContain('const slim');
  });
});

describe('updateNodeConfigInCode', () => {
  it('updates a source endpoint', () => {
    const code = `const users = source("users", { endpoint: "/api/users" });`;
    const result = updateNodeConfigInCode(code, 'users', 'endpoint', '"/api/v2/users"');
    expect(result).toContain('/api/v2/users');
    expect(result).not.toContain('/api/users"');
  });
});
