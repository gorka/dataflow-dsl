import { describe, it, expect } from 'vitest';
import { evaluateDsl } from './runtime';

describe('evaluateDsl', () => {
  it('registers a source node with config', () => {
    const registry = evaluateDsl(`
      const person = source("person", { endpoint: "/api/people" });
    `);
    expect(registry.nodes).toHaveLength(1);
    expect(registry.nodes[0]).toEqual({
      id: 'person',
      type: 'source',
      config: { endpoint: '/api/people' },
    });
    expect(registry.edges).toHaveLength(0);
  });

  it('registers chained transform nodes with edges', () => {
    const registry = evaluateDsl(`
      const person = source("person", { endpoint: "/api/people" });
      const slim = person.select(["name", "age"]);
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
      const person = source("person", { endpoint: "/api/people" });
      const order = source("order", { endpoint: ref(person, "id") });
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
      const person = source("person", { endpoint: "/api/people" });
      const adults = person.filter("age >= 18");
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
      const person = source("person", { endpoint: "/api/people" });
      const renamed = person.map({ fullName: "name", years: "age" });
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
      const person = source("person", { endpoint: "/api/people" });
      const order = source("order", { endpoint: "/api/orders" });
      const enriched = person.join(order, { as: "orders" });
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
      const person = source("person", { endpoint: "/api/people" });
      const order = source("order", { endpoint: "/api/orders" });
      const enriched = person.join(order, { on: ["id", "person_id"] });
    `);
    const joinNode = registry.nodes.find((n) => n.type === 'join')!;
    expect(joinNode).toMatchObject({
      config: { nodeId: 'order', on: ['id', 'person_id'] },
    });
  });

  it('handles chained transforms', () => {
    const registry = evaluateDsl(`
      const person = source("person", { endpoint: "/api/people" });
      const result = person.select(["name", "age"]).filter("age >= 18");
    `);
    expect(registry.nodes).toHaveLength(3);

    const selectNode = registry.nodes.find((n) => n.type === 'select')!;
    const filterNode = registry.nodes.find((n) => n.type === 'filter')!;

    expect(selectNode).toMatchObject({
      type: 'select',
      config: { fields: ['name', 'age'] },
      parentId: 'person',
    });
    expect(filterNode).toMatchObject({
      id: 'result',
      type: 'filter',
      config: { expression: 'age >= 18' },
      parentId: selectNode.id,
    });

    expect(registry.edges).toContainEqual({
      source: 'person',
      target: selectNode.id,
      type: 'chain',
    });
    expect(registry.edges).toContainEqual({
      source: selectNode.id,
      target: 'result',
      type: 'chain',
    });
  });

  it('throws on syntax errors', () => {
    expect(() => evaluateDsl('const x = ;;')).toThrow();
  });
});
