// Webhook Worker — Delivery Tests
import { describe, expect, test } from 'bun:test';
import { signPayload, buildHeaders, getBackoffDelay, calculateNextRetry, sendWebhook } from '../delivery';

describe('HMAC-SHA256 Signing', () => {
  test('signPayload generates consistent signature', () => {
    const payload = { event: 'test', id: '123' };
    const sig1 = signPayload(payload, 'my-secret');
    const sig2 = signPayload(payload, 'my-secret');
    expect(sig1).toBe(sig2);
  });

  test('signPayload changes with different secrets', () => {
    const payload = { event: 'test' };
    const sig1 = signPayload(payload, 'secret-1');
    const sig2 = signPayload(payload, 'secret-2');
    expect(sig1).not.toBe(sig2);
  });

  test('signPayload changes with different payloads', () => {
    const sig1 = signPayload({ a: 1 }, 'secret');
    const sig2 = signPayload({ a: 2 }, 'secret');
    expect(sig1).not.toBe(sig2);
  });

  test('buildHeaders includes required headers', () => {
    const payload = { event: 'user.created' };
    const headers = buildHeaders('my-secret', payload, 'sub-123');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Forge-Signature-256']).toBeDefined();
    expect(headers['X-Forge-Subscription-Id']).toBe('sub-123');
    expect(headers['X-Forge-Event']).toBe('user.created');
    expect(headers['User-Agent']).toBe('Forge-Webhook/1.0');
  });

  test('signature is hex string of proper length', () => {
    const sig = signPayload({ test: true }, 'secret');
    // SHA-256 HMAC is 64 hex characters
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('Exponential Backoff', () => {
  test('getBackoffDelay returns increasing delays', () => {
    const delays = [0, 1, 2, 3, 4].map(getBackoffDelay);
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
    }
  });

  test('getBackoffDelay starts at 10s', () => {
    expect(getBackoffDelay(0)).toBe(10_000);
  });

  test('getBackoffDelay caps at 1 hour', () => {
    const delay = getBackoffDelay(100);
    expect(delay).toBeLessThanOrEqual(3_600_000);
  });

  test('calculateNextRetry returns future date', () => {
    const future = calculateNextRetry(0);
    expect(future.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('sendWebhook', () => {
  test('sendWebhook fails for invalid URL', async () => {
    const result = await sendWebhook('', {}, {});
    expect(result.success).toBe(false);
  });

  test('sendWebhook handles invalid scheme gracefully', async () => {
    const result = await sendWebhook('ftp://invalid-scheme', {}, {});
    expect(result.success).toBe(false);
  });

  test('sendWebhook returns expected shape on any outcome', async () => {
    const result = await sendWebhook('http://localhost:1', {}, { 'Content-Type': 'application/json' });
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('statusCode');
  });
});
