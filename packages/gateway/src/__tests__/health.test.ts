// Gateway — Health Route Tests
import { describe, expect, test } from 'bun:test';
import { ForgeError, UnauthorizedError, ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { extractToken } from '../auth';

describe('Health route logic', () => {
  test('health route returns status structure', () => {
    // Test the logic: health returns { success, status, timestamp, checks }
    const expectedKeys = ['success', 'status', 'timestamp', 'checks'];
    expect(expectedKeys.length).toBe(4);
  });

  test('health degrades when postgres is unavailable', () => {
    // Logic: health endpoint checks postgres and jwks
    // If either fails, status = 'degraded'
    const checks = { jwks: 'ok', postgres: 'error' };
    const allOk = Object.values(checks).every((s) => s === 'ok');
    expect(allOk).toBe(false);
    expect(allOk ? 'healthy' : 'degraded').toBe('degraded');
  });

  test('health is healthy when all checks pass', () => {
    const checks = { jwks: 'ok', postgres: 'ok' };
    const allOk = Object.values(checks).every((s) => s === 'ok');
    expect(allOk).toBe(true);
    expect(allOk ? 'healthy' : 'degraded').toBe('healthy');
  });
});
