import { describe, it, expect } from 'vitest';
import { evaluateDsl } from './runtime';

describe('evaluateDsl', () => {
  it('registers a source node with config', () => {
    const registry = evaluateDsl(`
      source("person", { endpoint: "/api/people" });
    `);
    expect(registry.nodes).toHaveLength(1);
    expect(registry.nodes[0]).toEqual({
      id: 'person',
      type: 'source',
      config: { endpoint: '/api/people' },
    });
    expect(registry.edges).toHaveLength(0);
  });

  it('registers a select transform with edge', () => {
    const registry = evaluateDsl(`
      source("person", { endpoint: "/api/people" });
      select("slim", "person", ["name", "age"]);
    `);
    expect(registry.nodes).toHaveLength(2);
    expect(registry.nodes[1]).toMatchObject({
      id: 'slim',
      type: 'select',
      config: { fields: ['name', 'age'] },
      parentId: 'person',
    });
    expect(registry.edges).toContainEqual({
      source: 'person',
      target: 'slim',
      type: 'chain',
    });
  });

  it('registers ref() as a ref edge', () => {
    const registry = evaluateDsl(`
      source("person", { endpoint: "/api/people" });
      source("order", { endpoint: ref("person", "id") });
    `);
    expect(registry.nodes).toHaveLength(2);
    expect(registry.edges).toContainEqual({
      source: 'person',
      target: 'order',
      type: 'ref',
    });
    const orderNode = registry.nodes.find((n) => n.id === 'order')!;
    expect((orderNode.config as { endpoint: unknown }).endpoint).toEqual({
      __ref: true,
      nodeId: 'person',
      field: 'id',
    });
  });

  it('registers filter nodes', () => {
    const registry = evaluateDsl(`
      source("person", { endpoint: "/api/people" });
      filter("adults", "person", "age >= 18");
    `);
    expect(registry.nodes).toHaveLength(2);
    expect(registry.nodes[1]).toMatchObject({
      id: 'adults',
      type: 'filter',
      config: { expression: 'age >= 18' },
      parentId: 'person',
    });
    expect(registry.edges).toContainEqual({
      source: 'person',
      target: 'adults',
      type: 'chain',
    });
  });

  it('registers map nodes', () => {
    const registry = evaluateDsl(`
      source("person", { endpoint: "/api/people" });
      map("renamed", "person", { fullName: "name", years: "age" });
    `);
    expect(registry.nodes[1]).toMatchObject({
      id: 'renamed',
      type: 'map',
      config: { mapping: { fullName: 'name', years: 'age' } },
      parentId: 'person',
    });
  });

  it('registers join nodes with as', () => {
    const registry = evaluateDsl(`
      source("person", { endpoint: "/api/people" });
      source("order", { endpoint: "/api/orders" });
      join("enriched", "person", "order", { as: "orders" });
    `);
    expect(registry.nodes).toHaveLength(3);
    const joinNode = registry.nodes.find((n) => n.type === 'join')!;
    expect(joinNode).toMatchObject({
      id: 'enriched',
      type: 'join',
      config: { nodeId: 'order', as: 'orders' },
      parentId: 'person',
    });
    expect(registry.edges).toContainEqual({
      source: 'person',
      target: 'enriched',
      type: 'chain',
    });
    expect(registry.edges).toContainEqual({
      source: 'order',
      target: 'enriched',
      type: 'join',
    });
  });

  it('registers join nodes with on', () => {
    const registry = evaluateDsl(`
      source("person", { endpoint: "/api/people" });
      source("order", { endpoint: "/api/orders" });
      join("enriched", "person", "order", { on: ["id", "person_id"] });
    `);
    const joinNode = registry.nodes.find((n) => n.type === 'join')!;
    expect(joinNode).toMatchObject({
      config: { nodeId: 'order', on: ['id', 'person_id'] },
    });
  });

  it('handles chained transforms', () => {
    const registry = evaluateDsl(`
      source("person", { endpoint: "/api/people" });
      select("slim", "person", ["name", "age"]);
      filter("adults", "slim", "age >= 18");
    `);
    expect(registry.nodes).toHaveLength(3);
    expect(registry.nodes[1]).toMatchObject({
      id: 'slim',
      type: 'select',
      config: { fields: ['name', 'age'] },
      parentId: 'person',
    });
    expect(registry.nodes[2]).toMatchObject({
      id: 'adults',
      type: 'filter',
      config: { expression: 'age >= 18' },
      parentId: 'slim',
    });
    expect(registry.edges).toContainEqual({ source: 'person', target: 'slim', type: 'chain' });
    expect(registry.edges).toContainEqual({ source: 'slim', target: 'adults', type: 'chain' });
  });

  it('returns error on syntax errors', () => {
    const registry = evaluateDsl('source(;;');
    expect(registry.error).toBeDefined();
  });

  it('returns partial results when code has a runtime error', () => {
    const registry = evaluateDsl(`
      source("person", { endpoint: "/api/people" });
      undefined.filter("x");
    `);
    expect(registry.nodes).toHaveLength(1);
    expect(registry.nodes[0].id).toBe('person');
    expect(registry.error).toBeDefined();
  });

  it('accepts source with empty endpoint', () => {
    const registry = evaluateDsl(`source("api", { endpoint: "" });`);
    expect(registry.error).toBeUndefined();
    expect(registry.nodes).toHaveLength(1);
    expect(registry.nodes[0].id).toBe('api');
  });

  it('accepts filter with empty parent and expression', () => {
    const registry = evaluateDsl(`filter("f1", "", "");`);
    expect(registry.error).toBeUndefined();
    expect(registry.nodes).toHaveLength(1);
    expect(registry.nodes[0]).toMatchObject({
      id: 'f1',
      type: 'filter',
      config: { expression: '' },
    });
    expect(registry.nodes[0].parentId).toBeUndefined();
  });

  it('accepts map with empty parent', () => {
    const registry = evaluateDsl(`map("m1", "", { a: "b" });`);
    expect(registry.error).toBeUndefined();
    expect(registry.nodes[0]).toMatchObject({ id: 'm1', type: 'map' });
  });

  it('accepts select with empty parent', () => {
    const registry = evaluateDsl(`select("s1", "", ["name"]);`);
    expect(registry.error).toBeUndefined();
    expect(registry.nodes[0]).toMatchObject({ id: 's1', type: 'select' });
  });

  it('accepts join with empty parent and empty other', () => {
    const registry = evaluateDsl(`join("j1", "", "", { as: "data" });`);
    expect(registry.error).toBeUndefined();
    expect(registry.nodes[0]).toMatchObject({ id: 'j1', type: 'join' });
  });
});
