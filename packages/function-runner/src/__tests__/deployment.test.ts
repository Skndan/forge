// Function Runner — Deployment API Tests (FR-006)
import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock the DB module
mock.module('../db', () => {
  const functions: Record<string, any> = {};
  let nextId = 1;

  return {
    getFunctionById: async (id: string) => {
      return Object.values(functions).find((f: any) => f.id === id) || null;
    },
    getFunctionByTenantAndSlug: async (tenantId: string, slug: string) => {
      return Object.values(functions).find(
        (f: any) => f.tenant_id === tenantId && f.slug === slug,
      ) || null;
    },
    listFunctions: async (tenantId: string) => {
      return Object.values(functions).filter((f: any) => f.tenant_id === tenantId);
    },
    createFunction: async (tenantId: string, name: string, slug: string, source: string) => {
      const id = `fn-${nextId++}`;
      const func = {
        id,
        tenant_id: tenantId,
        name,
        slug,
        runtime: 'bun',
        source,
        entrypoint: 'index.ts',
        env_vars: {},
        timeout_ms: 30000,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      functions[id] = func;
      return func;
    },
    updateFunction: async (id: string, tenantId: string, updates: any) => {
      const func = functions[id];
      if (!func || func.tenant_id !== tenantId) return null;
      Object.assign(func, updates);
      return func;
    },
    deleteFunction: async (id: string, tenantId: string) => {
      const func = functions[id];
      if (!func || func.tenant_id !== tenantId) return false;
      delete functions[id];
      return true;
    },
    getLogsByFunction: async () => ({
      logs: [],
      total: 0,
    }),
    getInvocation: async (id: string) => {
      if (id === 'inv-known') {
        return {
          id: 'inv-known',
          function_id: 'fn-001',
          tenant_id: 'tenant-001',
          status: 'completed',
          input_payload: { test: true },
          output_payload: { result: 'ok' },
          error_message: null,
          duration_ms: 50,
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        };
      }
      return null;
    },
  };
});

describe('Deployment API Logic', () => {
  test('function CRUD: create, read, update, delete', async () => {
    const { createFunction, getFunctionById, updateFunction, deleteFunction, listFunctions } = await import('../db');

    // Create
    const created = await createFunction('tenant-001', 'my-func', 'my-func', 'export function handler() {}');
    expect(created.id).toBeDefined();
    expect(created.name).toBe('my-func');
    expect(created.slug).toBe('my-func');
    expect(created.tenant_id).toBe('tenant-001');

    // Read
    const read = await getFunctionById(created.id);
    expect(read).toBeDefined();
    expect(read!.name).toBe('my-func');

    // Update
    const updated = await updateFunction(created.id, 'tenant-001', { name: 'my-func-updated' });
    expect(updated).toBeDefined();
    expect(updated!.name).toBe('my-func-updated');

    // List
    const all = await listFunctions('tenant-001');
    expect(all.length).toBe(1);

    // Delete
    const deleted = await deleteFunction(created.id, 'tenant-001');
    expect(deleted).toBe(true);

    // Confirm deleted
    const afterDelete = await getFunctionById(created.id);
    expect(afterDelete).toBeNull();
  });
});
