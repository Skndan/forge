// Function Runner — Scoped JWT Tests (FR-004)
import { describe, expect, test } from 'bun:test';
import { generateScopedJwt, validateScope, defaultScope } from '../jwt.js';

describe('generateScopedJwt', () => {
  test('generates a valid JWT token string', async () => {
    const token = await generateScopedJwt({
      invocationId: 'inv-001',
      functionId: 'fn-001',
      tenantId: 'tenant-001',
      invokedBy: 'user-001',
    });

    expect(typeof token).toBe('string');
    // JWT has 3 parts separated by dots
    expect(token.split('.')).toHaveLength(3);
  });

  test('includes custom claims in token payload', async () => {
    const token = await generateScopedJwt({
      invocationId: 'inv-002',
      functionId: 'fn-002',
      tenantId: 'tenant-002',
      invokedBy: 'user-002',
      allowedTables: ['users', 'orders'],
      allowedBuckets: ['uploads'],
      maxQueries: 50,
    });

    expect(typeof token).toBe('string');
    const parts = token.split('.');
    expect(parts.length).toBe(3);

    // Decode the payload (middle part)
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString(),
    );

    expect(payload.invocation_id).toBe('inv-002');
    expect(payload.function_id).toBe('fn-002');
    expect(payload.tenant_id).toBe('tenant-002');
    expect(payload.invoked_by).toBe('user-002');
    expect(payload.allowed_tables).toEqual(['users', 'orders']);
    expect(payload.allowed_buckets).toEqual(['uploads']);
    expect(payload.max_queries).toBe(50);
  });

  test('has expiration time', async () => {
    const token = await generateScopedJwt({
      invocationId: 'inv-003',
      functionId: 'fn-003',
      tenantId: 'tenant-003',
      invokedBy: 'user-003',
      ttlSeconds: 60,
    });

    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString(),
    );

    expect(payload.exp).toBeGreaterThan(payload.iat);
    expect(payload.exp - payload.iat).toBe(60);
  });

  test('generates unique jti for each token', async () => {
    const token1 = await generateScopedJwt({
      invocationId: 'inv-001',
      functionId: 'fn-001',
      tenantId: 'tenant-001',
      invokedBy: 'user-001',
    });

    const token2 = await generateScopedJwt({
      invocationId: 'inv-002',
      functionId: 'fn-001',
      tenantId: 'tenant-001',
      invokedBy: 'user-001',
    });

    const payload1 = JSON.parse(
      Buffer.from(token1.split('.')[1], 'base64url').toString(),
    );
    const payload2 = JSON.parse(
      Buffer.from(token2.split('.')[1], 'base64url').toString(),
    );

    expect(payload1.jti).not.toBe(payload2.jti);
  });
});

describe('validateScope', () => {
  const validToken = {
    invocation_id: 'inv-001',
    function_id: 'fn-001',
    tenant_id: 'tenant-001',
    invoked_by: 'user-001',
    allowed_tables: ['users', 'orders'],
    allowed_buckets: ['uploads'],
    max_queries: 50,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    iss: 'forge-function-runner',
    aud: 'forge-function',
    jti: 'jti-001',
  };

  test('allows access to allowed tables', () => {
    const result = validateScope(validToken, 'users');
    expect(result.allowed).toBe(true);
  });

  test('denies access to disallowed tables', () => {
    const result = validateScope(validToken, 'secrets');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('secrets');
  });

  test('allows access when no table restriction is set', () => {
    const token = { ...validToken, allowed_tables: undefined };
    const result = validateScope(token, 'anything');
    expect(result.allowed).toBe(true);
  });

  test('allows access to allowed buckets', () => {
    const result = validateScope(validToken, undefined, 'uploads');
    expect(result.allowed).toBe(true);
  });

  test('denies access to disallowed buckets', () => {
    const result = validateScope(validToken, undefined, 'admin-files');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('admin-files');
  });

  test('denies expired tokens', () => {
    const expiredToken = {
      ...validToken,
      exp: Math.floor(Date.now() / 1000) - 10,
    };
    const result = validateScope(expiredToken);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('expired');
  });
});

describe('defaultScope', () => {
  test('returns wildcard table and bucket access', () => {
    const scope = defaultScope({
      invocationId: 'inv-001',
      functionId: 'fn-001',
      tenantId: 'tenant-001',
      invokedBy: 'user-001',
    });

    expect(scope.allowedTables).toEqual(['*']);
    expect(scope.allowedBuckets).toEqual(['*']);
    expect(scope.maxQueries).toBe(100);
    expect(scope.ttlSeconds).toBe(60);
  });
});
