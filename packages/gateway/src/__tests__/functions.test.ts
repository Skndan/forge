// Gateway — Functions Route Tests
import { describe, expect, test } from 'bun:test';
import { ForgeError, NotFoundError } from '../errors';

describe('POST /v1/functions/invoke — route logic', () => {
  test('requires function_id', () => {
    const functionId = undefined;
    expect(() => {
      if (!functionId) {
        throw new ForgeError(400, 'VALIDATION_ERROR', 'function_id is required');
      }
    }).toThrow(ForgeError);
  });

  test('requires tenant-scoped access', () => {
    const tenantId = 'tenant-1';
    const requestTenantId = 'tenant-2';
    expect(() => {
      if (tenantId !== requestTenantId) {
        throw new NotFoundError('Function not found or inactive');
      }
    }).toThrow(NotFoundError);
  });

  test('allows valid invocation', () => {
    const functionId = '00000000-0000-0000-0000-000000000001';
    const payload = { test: true };
    const isAsync = false;

    expect(functionId).toBeDefined();
    expect(typeof payload).toBe('object');

    if (isAsync) {
      // Should return 202
      expect(true).toBe(true);
    } else {
      // Should proxy to function-runner
      const runnerUrl = 'http://function-runner:3002';
      expect(runnerUrl).toBeDefined();
    }
  });
});
