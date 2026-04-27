import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executePipeline } from './execute';
import type { NodeRegistry } from '../types';

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(responses: Record<string, unknown>) {
  global.fetch = vi.fn((url: string | URL | Request) => {
    const key = typeof url === 'string' ? url : url.toString();
    const body = responses[key] ?? responses['*'];
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(body),
    } as Response);
  });
}

describe('executePipeline', () => {
  it('executes a source node with nested object response', async () => {
    mockFetch({
      'https://swapi.dev/api/people/1': {
        result: { properties: { name: 'Luke Skywalker', height: '172' } },
      },
    });

    const registry: NodeRegistry = {
      nodes: [{ id: 'person', type: 'source', config: { endpoint: 'https://swapi.dev/api/people/1' } }],
      edges: [],
    };

    const results = await executePipeline(registry);
    expect(results.get('person')?.status).toBe('success');
    expect(results.get('person')?.data?.items).toEqual([
      { result: { properties: { name: 'Luke Skywalker', height: '172' } } },
    ]);
  });

  it('normalizes array response (plain array used directly)', async () => {
    mockFetch({
      'https://api.example.com/users': [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
    });

    const registry: NodeRegistry = {
      nodes: [{ id: 'users', type: 'source', config: { endpoint: 'https://api.example.com/users' } }],
      edges: [],
    };

    const results = await executePipeline(registry);
    expect(results.get('users')?.status).toBe('success');
    expect(results.get('users')?.data?.items).toEqual([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]);
  });

  it('executes select transform', async () => {
    mockFetch({
      'https://api.example.com/users': [{ id: 1, name: 'Alice', age: 30 }],
    });

    const registry: NodeRegistry = {
      nodes: [
        { id: 'users', type: 'source', config: { endpoint: 'https://api.example.com/users' } },
        { id: 'slim', type: 'select', config: { fields: ['id', 'name'] }, parentId: 'users' },
      ],
      edges: [{ source: 'users', target: 'slim', type: 'chain' }],
    };

    const results = await executePipeline(registry);
    expect(results.get('slim')?.status).toBe('success');
    expect(results.get('slim')?.data?.items).toEqual([{ id: 1, name: 'Alice' }]);
  });

  it('executes filter transform', async () => {
    mockFetch({
      'https://api.example.com/users': [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 17 },
      ],
    });

    const registry: NodeRegistry = {
      nodes: [
        { id: 'users', type: 'source', config: { endpoint: 'https://api.example.com/users' } },
        { id: 'adults', type: 'filter', config: { expression: 'age >= 18' }, parentId: 'users' },
      ],
      edges: [{ source: 'users', target: 'adults', type: 'chain' }],
    };

    const results = await executePipeline(registry);
    expect(results.get('adults')?.status).toBe('success');
    expect(results.get('adults')?.data?.items).toEqual([{ name: 'Alice', age: 30 }]);
  });

  it('executes map transform', async () => {
    mockFetch({
      'https://api.example.com/users': [{ name: 'Alice', age: 30 }],
    });

    const registry: NodeRegistry = {
      nodes: [
        { id: 'users', type: 'source', config: { endpoint: 'https://api.example.com/users' } },
        { id: 'renamed', type: 'map', config: { mapping: { fullName: 'name', years: 'age' } }, parentId: 'users' },
      ],
      edges: [{ source: 'users', target: 'renamed', type: 'chain' }],
    };

    const results = await executePipeline(registry);
    expect(results.get('renamed')?.status).toBe('success');
    expect(results.get('renamed')?.data?.items).toEqual([{ fullName: 'Alice', years: 30 }]);
  });

  it('executes enrichment join (as) — attaches right collection under key', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ id: 1, name: 'Alice' }]) } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ id: 10, text: 'Order A' }]) } as Response);

    const registry: NodeRegistry = {
      nodes: [
        { id: 'users', type: 'source', config: { endpoint: 'https://api.example.com/users' } },
        { id: 'orders', type: 'source', config: { endpoint: 'https://api.example.com/orders' } },
        { id: 'enriched', type: 'join', config: { nodeId: 'orders', as: 'orders' }, parentId: 'users' },
      ],
      edges: [
        { source: 'users', target: 'enriched', type: 'chain' },
        { source: 'orders', target: 'enriched', type: 'join' },
      ],
    };

    const results = await executePipeline(registry);
    expect(results.get('enriched')?.status).toBe('success');
    expect(results.get('enriched')?.data?.items).toEqual([
      { id: 1, name: 'Alice', orders: [{ id: 10, text: 'Order A' }] },
    ]);
  });

  it('resolves ref() in params — single URL', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 1, profileUrl: 'https://api.example.com/profiles/1' }]),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ bio: 'Software engineer' }]),
      } as Response);

    const registry: NodeRegistry = {
      nodes: [
        { id: 'users', type: 'source', config: { endpoint: 'https://api.example.com/users' } },
        {
          id: 'profile',
          type: 'source',
          config: {
            endpoint: '{url}',
            params: { url: { __ref: true, nodeId: 'users', field: 'profileUrl' } },
          },
        },
      ],
      edges: [{ source: 'users', target: 'profile', type: 'ref' }],
    };

    const results = await executePipeline(registry);
    expect(results.get('profile')?.status).toBe('success');
    expect(results.get('profile')?.data?.items).toEqual([{ bio: 'Software engineer' }]);
  });

  it('resolves ref() in params — array of URLs (parallel fetch)', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { profileUrl: 'https://api.example.com/profiles/1' },
          { profileUrl: 'https://api.example.com/profiles/2' },
        ]),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ bio: 'Engineer' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ bio: 'Designer' }),
      } as Response);

    const registry: NodeRegistry = {
      nodes: [
        { id: 'users', type: 'source', config: { endpoint: 'https://api.example.com/users' } },
        {
          id: 'profiles',
          type: 'source',
          config: {
            endpoint: '{url}',
            params: { url: { __ref: true, nodeId: 'users', field: 'profileUrl' } },
          },
        },
      ],
      edges: [{ source: 'users', target: 'profiles', type: 'ref' }],
    };

    const results = await executePipeline(registry);
    expect(results.get('profiles')?.status).toBe('success');
    expect(results.get('profiles')?.data?.items).toEqual([{ bio: 'Engineer' }, { bio: 'Designer' }]);
  });

  it('propagates errors and stops downstream nodes', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const registry: NodeRegistry = {
      nodes: [
        { id: 'users', type: 'source', config: { endpoint: 'https://api.example.com/users' } },
        { id: 'adults', type: 'filter', config: { expression: 'age >= 18' }, parentId: 'users' },
      ],
      edges: [{ source: 'users', target: 'adults', type: 'chain' }],
    };

    const results = await executePipeline(registry);
    expect(results.get('users')?.status).toBe('error');
    expect(results.get('adults')?.status).toBe('error');
    expect(results.get('adults')?.error).toBe('Upstream node failed');
  });

  it('skips orphan nodes during execution', async () => {
    mockFetch({
      'https://api.example.com/users': [{ name: 'Alice' }],
    });

    const registry: NodeRegistry = {
      nodes: [
        { id: 'users', type: 'source', config: { endpoint: 'https://api.example.com/users' } },
        { id: 'connected', type: 'filter', config: { expression: 'true' }, parentId: 'users' },
        { id: 'orphan', type: 'filter', config: { expression: 'x > 1' } },
      ],
      edges: [{ source: 'users', target: 'connected', type: 'chain' }],
    };

    const results = await executePipeline(registry);
    expect(results.get('users')?.status).toBe('success');
    expect(results.get('connected')?.status).toBe('success');
    expect(results.get('orphan')?.status).toBe('skipped');
  });
});
