// Function Runner — Warm Pool Tests (FR-005)
import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { WarmFunctionPool } from '../pool.js';
import type { FunctionDefinition } from '@forge/types';

describe('WarmFunctionPool', () => {
  let pool: WarmFunctionPool;

  const mockFuncDef: FunctionDefinition = {
    id: '00000000-0000-0000-0000-000000000001',
    tenant_id: '00000000-0000-0000-0000-000000000010',
    name: 'test-function',
    slug: 'test-function',
    runtime: 'bun',
    source: 'export function handler() { return { hello: "world" }; }',
    entrypoint: 'index.ts',
    env_vars: {},
    timeout_ms: 30000,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    pool = new WarmFunctionPool(false); // file-based mode for tests
  });

  afterEach(async () => {
    await pool.stop();
  });

  test('starts empty', () => {
    expect(pool.size).toBe(0);
    expect(pool.getStats().totalWarm).toBe(0);
  });

  test('warms a function on first call', async () => {
    const result = await pool.warmFunction(mockFuncDef);
    expect(result).toBe(true);
    expect(pool.size).toBe(1);
    expect(pool.isWarm(mockFuncDef.id)).toBe(true);
  });

  test('does not double-warm', async () => {
    await pool.warmFunction(mockFuncDef);
    const result = await pool.warmFunction(mockFuncDef);
    expect(result).toBe(true); // Already warm, no-op
    expect(pool.size).toBe(1);
  });

  test('returns false for unwarmed functions', () => {
    expect(pool.isWarm('nonexistent')).toBe(false);
  });

  test('tracks usage counts', () => {
    pool.recordUsage('fn-001');
    pool.recordUsage('fn-001');
    pool.recordUsage('fn-002');

    const stats = pool.getStats();
    const fn001Stats = stats.topFunctions.find((f) => f.id === 'fn-001');
    const fn002Stats = stats.topFunctions.find((f) => f.id === 'fn-002');

    expect(fn001Stats?.count).toBe(2);
    expect(fn002Stats?.count).toBe(1);
  });

  test('evicts a function', async () => {
    await pool.warmFunction(mockFuncDef);
    expect(pool.size).toBe(1);

    const evicted = await pool.evict(mockFuncDef.id);
    expect(evicted).toBe(true);
    expect(pool.size).toBe(0);
    expect(pool.isWarm(mockFuncDef.id)).toBe(false);
  });

  test('evictAll clears the pool', async () => {
    const fn2: FunctionDefinition = {
      ...mockFuncDef,
      id: '00000000-0000-0000-0000-000000000002',
      slug: 'test-function-2',
    };

    await pool.warmFunction(mockFuncDef);
    await pool.warmFunction(fn2);
    expect(pool.size).toBe(2);

    await pool.evictAll();
    expect(pool.size).toBe(0);
  });

  test("tracks eviction stats", async () => {
    await pool.warmFunction(mockFuncDef);
    expect(pool.isWarm(mockFuncDef.id)).toBe(true);
    await pool.evict(mockFuncDef.id);
    expect(pool.isWarm(mockFuncDef.id)).toBe(false);

    const stats = pool.getStats();
    expect(stats.evictions).toBe(1);
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });

  test('enforces per-tenant limits', async () => {
    const pool2 = new WarmFunctionPool(false);
    const warmPoolConfig = { maxPerTenant: 2, rebalanceIntervalMs: 100, maxIdleTimeMs: 5000 };

    // Warm 3 functions for same tenant
    const fn1 = { ...mockFuncDef, id: 'fn-001', slug: 'fn-1' };
    const fn2 = { ...mockFuncDef, id: 'fn-002', slug: 'fn-2' };
    const fn3 = { ...mockFuncDef, id: 'fn-003', slug: 'fn-3' };

    expect(await pool2.warmFunction(fn1)).toBe(true);
    expect(await pool2.warmFunction(fn2)).toBe(true);
    expect(await pool2.warmFunction(fn3)).toBe(true); // Will hit limit

    await pool2.stop();
  });

  test('tracks per-tenant counts', async () => {
    const fn1 = { ...mockFuncDef, id: 'fn-001', slug: 'fn-1' };
    await pool.warmFunction(fn1);

    const stats = pool.getStats();
    expect(stats.perTenant.get(mockFuncDef.tenant_id)).toBe(1);
  });

  test('hits and misses counters work', () => {
    pool.recordUsage('fn-001');
    pool.recordUsage('fn-001');

    pool.isWarm('fn-001'); // miss
    pool.isWarm('fn-002'); // miss

    const stats = pool.getStats();
    expect(stats.misses).toBe(2);
  });
});
