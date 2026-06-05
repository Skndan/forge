// Gateway — Auth Tests
import { describe, expect, test, mock } from 'bun:test';
import { extractToken, verifyToken, clearJwksCache } from '../auth';

describe('extractToken', () => {
  test('extracts Bearer token from authorization header', () => {
    const token = extractToken('Bearer my-token-123');
    expect(token).toBe('my-token-123');
  });

  test('returns null for missing header', () => {
    expect(extractToken(undefined)).toBeNull();
  });

  test('returns null for malformed header', () => {
    expect(extractToken('Basic token')).toBeNull();
    expect(extractToken('Bearer')).toBeNull();
    expect(extractToken('')).toBeNull();
  });

  test('is case-insensitive for Bearer', () => {
    const token = extractToken('bearer my-token');
    expect(token).toBe('my-token');
  });
});

describe('verifyToken', () => {
  test('rejects invalid token format', async () => {
    await expect(verifyToken('invalid-token')).rejects.toThrow();
  });

  test('rejects expired/malformed token', async () => {
    const badToken =
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature';
    await expect(verifyToken(badToken)).rejects.toThrow();
  });

  test('clearJwksCache works', () => {
    clearJwksCache();
    // No crash means success
    expect(true).toBe(true);
  });
});
