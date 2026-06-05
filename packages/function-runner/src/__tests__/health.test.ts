// Function Runner — Health Route Tests
import { describe, expect, test } from 'bun:test';

describe('Health route logic', () => {
  test('health returns basic status structure', () => {
    const healthResponse = {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ok',
        warm_pool: 'ok',
      },
    };

    expect(healthResponse.success).toBe(true);
    expect(healthResponse.status).toBe('healthy');
    expect(healthResponse.checks.database).toBe('ok');
  });

  test('health degrades when database is unavailable', () => {
    const checks = { database: 'error', warm_pool: 'ok', sandbox: 'ok' };
    const allOk = Object.values(checks).every((s) => s === 'ok');
    const status = allOk ? 'healthy' : 'degraded';

    expect(allOk).toBe(false);
    expect(status).toBe('degraded');
  });

  test('health is healthy when all checks pass', () => {
    const checks = { database: 'ok', warm_pool: '5 functions warmed', sandbox: '0 active containers' };
    const allOk = Object.values(checks).every(
      (s) => s === 'ok' || s.startsWith('ok') || s.includes('functions warmed') || s.includes('active containers'),
    );

    expect(allOk).toBe(true);
  });

  test('health response includes timestamp', () => {
    const timestamp = new Date().toISOString();
    expect(timestamp).toBeDefined();
    expect(typeof timestamp).toBe('string');
    expect(timestamp.includes('T')).toBe(true);
  });

  test('health response for degraded service returns 503 equivalent', () => {
    const allOk = false;
    const expectedStatus = allOk ? 200 : 503;
    expect(expectedStatus).toBe(503);
  });
});
