// Function Runner — Timeout + Resource Limits Tests (FR-008)
import { describe, expect, test } from 'bun:test';
import {
  resolveLimits,
  validateFunctionSource,
  validateTimeout,
  createTimeoutController,
  calculateMemoryBudget,
  calculateCpuShares,
} from '../limits.js';
import type { FunctionDefinition } from '@forge/types';

describe('resolveLimits', () => {
  test('uses function timeout when specified', () => {
    const funcDef: FunctionDefinition = {
      id: 'test',
      tenant_id: 'test',
      name: 'test',
      slug: 'test',
      runtime: 'bun',
      source: 'export function handler() {}',
      entrypoint: 'index.ts',
      env_vars: {},
      timeout_ms: 15000,
      is_active: true,
      created_at: '',
      updated_at: '',
    };

    const limits = resolveLimits(funcDef);
    expect(limits.timeoutMs).toBe(15000);
  });

  test('falls back to default timeout when not specified', () => {
    const funcDef: FunctionDefinition = {
      id: 'test',
      tenant_id: 'test',
      name: 'test',
      slug: 'test',
      runtime: 'bun',
      source: 'export function handler() {}',
      entrypoint: 'index.ts',
      env_vars: {},
      timeout_ms: 0,
      is_active: true,
      created_at: '',
      updated_at: '',
    };

    const limits = resolveLimits(funcDef);
    expect(limits.timeoutMs).toBe(30000); // default
  });

  test('clamps timeout to maximum', () => {
    const funcDef: FunctionDefinition = {
      id: 'test',
      tenant_id: 'test',
      name: 'test',
      slug: 'test',
      runtime: 'bun',
      source: 'export function handler() {}',
      entrypoint: 'index.ts',
      env_vars: {},
      timeout_ms: 600000, // 10 min
      is_active: true,
      created_at: '',
      updated_at: '',
    };

    const limits = resolveLimits(funcDef);
    expect(limits.timeoutMs).toBeLessThanOrEqual(300000); // max 5 min
  });
});

describe('validateFunctionSource', () => {
  test('validates valid source', () => {
    const result = validateFunctionSource('export function handler() {}', 'index.ts');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('rejects empty source', () => {
    const result = validateFunctionSource('', 'index.ts');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Function source cannot be empty');
  });

  test('rejects empty entrypoint', () => {
    const result = validateFunctionSource('export function handler() {}', '');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Entrypoint cannot be empty');
  });

  test('rejects source exceeding max size', () => {
    const largeSource = 'x'.repeat(12000000); // 12 MB
    const result = validateFunctionSource(largeSource, 'index.ts');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('maximum size'))).toBe(true);
  });
});

describe('validateTimeout', () => {
  test('validates valid timeout', () => {
    const result = validateTimeout(30000);
    expect(result.valid).toBe(true);
  });

  test('rejects timeout below minimum', () => {
    const result = validateTimeout(50);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Timeout must be at least 100ms');
  });

  test('rejects timeout above maximum', () => {
    const result = validateTimeout(600000);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('maximum'))).toBe(true);
  });
});

describe('createTimeoutController', () => {
  test('creates a controller that can be aborted', () => {
    const { controller, clear } = createTimeoutController(5000);
    expect(controller.signal.aborted).toBe(false);
    clear();
  });

  test('aborts after timeout elapses', async () => {
    const { controller, clear } = createTimeoutController(10);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(controller.signal.aborted).toBe(true);
    clear();
  });

  test('clear prevents abort', async () => {
    const { controller, clear } = createTimeoutController(10);
    clear();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(controller.signal.aborted).toBe(false);
  });

  test('calls onTimeout callback when aborted', async () => {
    let called = false;
    const { clear } = createTimeoutController(10, () => {
      called = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(called).toBe(true);
    clear();
  });
});

describe('calculateMemoryBudget', () => {
  test('returns base allocation for short functions', () => {
    const budget = calculateMemoryBudget({ timeout_ms: 5000 });
    expect(budget).toBeGreaterThanOrEqual(128);
  });

  test('increases budget for longer functions', () => {
    const shortBudget = calculateMemoryBudget({ timeout_ms: 10000 });
    const longBudget = calculateMemoryBudget({ timeout_ms: 120000 });
    expect(longBudget).toBeGreaterThanOrEqual(shortBudget);
  });

  test('respects maximum memory', () => {
    const budget = calculateMemoryBudget({ timeout_ms: 600000 });
    expect(budget).toBeLessThanOrEqual(512);
  });
});

describe('calculateCpuShares', () => {
  test('returns default CPU shares', () => {
    const shares = calculateCpuShares({ timeout_ms: 30000 });
    expect(shares).toBeGreaterThan(0);
    expect(shares).toBeLessThanOrEqual(1024);
  });
});
