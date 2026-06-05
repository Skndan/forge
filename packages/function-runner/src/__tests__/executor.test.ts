// Function Runner — Executor Tests (FR-002)
import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { executeFunction, validateFunctionCode } from '../executor.js';
import type { FunctionDefinition } from '@forge/types';

// ── Mocks ─────────────────────────────────────────────────

const mockFunction: FunctionDefinition = {
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

// Mock getFunctionById
mock.module('../db', () => ({
  getFunctionById: async (id: string) => {
    if (id === mockFunction.id) return mockFunction;
    return null;
  },
  createInvocation: async () => ({
    id: 'inv-001',
    function_id: mockFunction.id,
    tenant_id: mockFunction.tenant_id,
    status: 'pending',
    input_payload: {},
    output_payload: null,
    error_message: null,
    duration_ms: 0,
    created_at: new Date().toISOString(),
    completed_at: null,
  }),
  completeInvocation: async () => {},
  failInvocation: async () => {},
  timeoutInvocation: async () => {},
}));

// Mock sandbox
mock.module('../sandbox', () => ({
  getSandbox: () => ({
    execute: async () => ({
      stdout: JSON.stringify({ hello: 'world' }),
      stderr: '',
      exitCode: 0,
      durationMs: 50,
    }),
  }),
}));

// Mock JWT
mock.module('../jwt', () => ({
  defaultScope: () => ({
    allowedTables: ['*'],
    allowedBuckets: ['*'],
    maxQueries: 100,
    ttlSeconds: 60,
  }),
  generateScopedJwt: async () => 'mock-jwt-token',
}));

// Mock logs
mock.module('../logs', () => ({
  getLogCollector: () => ({
    addStdout: () => {},
    addStderr: () => {},
  }),
  parseLogOutput: (output: string) => output.split('\n').filter(Boolean),
  truncateLogMessage: (msg: string) => msg,
}));

describe('executeFunction', () => {
  test('successfully executes a function and returns result', async () => {
    const result = await executeFunction({
      functionId: mockFunction.id,
      tenantId: mockFunction.tenant_id,
      payload: { name: 'test' },
      invokedBy: 'user-001',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ hello: 'world' });
    expect(result.invocationId).toBe('inv-001');
    expect(typeof result.durationMs).toBe('number');
  });

  test('returns error for non-existent function', async () => {
    const result = await executeFunction({
      functionId: '00000000-0000-0000-0000-000000009999',
      tenantId: mockFunction.tenant_id,
      payload: {},
      invokedBy: 'user-001',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('FUNCTION_NOT_FOUND');
  });

  test('returns error for tenant mismatch', async () => {
    const result = await executeFunction({
      functionId: mockFunction.id,
      tenantId: '00000000-0000-0000-0000-000000009999',
      payload: {},
      invokedBy: 'user-001',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('FORBIDDEN');
  });
});

describe('validateFunctionCode', () => {
  test('validates valid function source', async () => {
    const result = await validateFunctionCode(
      'export function handler() { return "hello"; }',
      'index.ts',
      {},
    );
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  test('rejects empty source', async () => {
    const result = await validateFunctionCode('', 'index.ts', {});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('rejects source without export', async () => {
    const result = await validateFunctionCode(
      'function handler() { return "hello"; }',
      'index.ts',
      {},
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('export'))).toBe(true);
  });
});
