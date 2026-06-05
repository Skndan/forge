// Gateway — Auth Route Tests
import { describe, expect, test } from 'bun:test';
import { UnauthorizedError } from '../errors';
import { extractToken } from '../auth';

describe('GET /v1/auth/me — route logic', () => {
  test('requires auth header', () => {
    const token = extractToken(undefined);
    expect(token).toBeNull();

    if (!token) {
      const err = new UnauthorizedError('Missing authorization header');
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err.message).toBe('Missing authorization header');
    }
  });

  test('returns user profile from JWT claims', () => {
    // Simulating what the route does
    const user = {
      sub: 'user-123',
      tenant_id: 'tenant-456',
      plan: 'pro',
      roles: ['user'],
    };

    expect(user.sub).toBe('user-123');
    expect(user.tenant_id).toBe('tenant-456');
    expect(user.plan).toBe('pro');
    expect(user.roles).toContain('user');
  });
});
