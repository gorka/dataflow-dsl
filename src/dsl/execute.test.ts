import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executePipeline } from './execute';
import type { NodeRegistry } from '../types';

beforeEach(() => {
  vi.restoreAllMocks();
});

const jsonHeaders = { get: (h: string) => h.toLowerCase() === 'content-type' ? 'application/json' : null };

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    headers: jsonHeaders,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

function mockFetch(responses: Record<string, unknown>) {
  global.fetch = vi.fn((url: string | URL | Request) => {
    const key = typeof url === 'string' ? url : url.toString();
    const body = responses[key] ?? responses['*'];
    return jsonResponse(body);
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
      .mockResolvedValueOnce(jsonResponse([{ id: 1, name: 'Alice' }]))
      .mockResolvedValueOnce(jsonResponse([{ id: 10, text: 'Order A' }]));

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
      .mockResolvedValueOnce(jsonResponse([{ id: 1, profileUrl: 'https://api.example.com/profiles/1' }]))
      .mockResolvedValueOnce(jsonResponse([{ bio: 'Software engineer' }]));

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
      .mockResolvedValueOnce(jsonResponse([
        { profileUrl: 'https://api.example.com/profiles/1' },
        { profileUrl: 'https://api.example.com/profiles/2' },
      ]))
      .mockResolvedValueOnce(jsonResponse({ bio: 'Engineer' }))
      .mockResolvedValueOnce(jsonResponse({ bio: 'Designer' }));

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
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

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

  it('reports empty endpoint clearly', async () => {
    const registry: NodeRegistry = {
      nodes: [{ id: 'api', type: 'source', config: { endpoint: '' } }],
      edges: [],
    };
    const results = await executePipeline(registry);
    expect(results.get('api')?.status).toBe('error');
    expect(results.get('api')?.error).toContain('empty');
  });

  it('reports invalid URL clearly', async () => {
    const registry: NodeRegistry = {
      nodes: [{ id: 'api', type: 'source', config: { endpoint: 'not-a-url' } }],
      edges: [],
    };
    const results = await executePipeline(registry);
    expect(results.get('api')?.status).toBe('error');
    expect(results.get('api')?.error).toContain('Invalid URL');
  });

  it('reports non-JSON response clearly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: (h: string) => h.toLowerCase() === 'content-type' ? 'text/html' : null },
      text: () => Promise.resolve('<html><body>Not Found</body></html>'),
    } as unknown as Response);

    const registry: NodeRegistry = {
      nodes: [{ id: 'api', type: 'source', config: { endpoint: 'https://example.com/api' } }],
      edges: [],
    };
    const results = await executePipeline(registry);
    expect(results.get('api')?.status).toBe('error');
    expect(results.get('api')?.error).toContain('Expected JSON');
    expect(results.get('api')?.error).toContain('text/html');
  });

  it('reports HTTP errors with status code', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: jsonHeaders,
    } as unknown as Response);

    const registry: NodeRegistry = {
      nodes: [{ id: 'api', type: 'source', config: { endpoint: 'https://api.example.com/missing' } }],
      edges: [],
    };
    const results = await executePipeline(registry);
    expect(results.get('api')?.status).toBe('error');
    expect(results.get('api')?.error).toContain('404');
  });

  it('reports unresolved placeholders', async () => {
    const registry: NodeRegistry = {
      nodes: [{ id: 'api', type: 'source', config: { endpoint: 'https://api.example.com/{id}', params: {} } }],
      edges: [],
    };
    const results = await executePipeline(registry);
    expect(results.get('api')?.status).toBe('error');
    expect(results.get('api')?.error).toContain('unresolved');
    expect(results.get('api')?.error).toContain('{id}');
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
