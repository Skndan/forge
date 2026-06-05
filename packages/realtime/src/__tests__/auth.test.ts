// Realtime — Auth Tests
import { describe, expect, test } from 'bun:test';
import { extractTokenFromUrl, extractTokenFromProtocol } from '../auth';

describe('extractTokenFromUrl', () => {
  test('extracts token from query parameter', () => {
    const token = extractTokenFromUrl('/ws?token=my-jwt-token');
    expect(token).toBe('my-jwt-token');
  });

  test('returns null when no token parameter', () => {
    const token = extractTokenFromUrl('/ws');
    expect(token).toBeNull();
  });

  test('returns null for empty url', () => {
    const token = extractTokenFromUrl('');
    expect(token).toBeNull();
  });
});

describe('extractTokenFromProtocol', () => {
  test('extracts token from token_ prefixed protocol', () => {
    const token = extractTokenFromProtocol(['token_my-jwt', 'graphql-ws']);
    expect(token).toBe('my-jwt');
  });

  test('returns null when no token protocol', () => {
    const token = extractTokenFromProtocol(['graphql-ws']);
    expect(token).toBeNull();
  });

  test('returns null for empty array', () => {
    const token = extractTokenFromProtocol([]);
    expect(token).toBeNull();
  });

  test('returns null for prefix-only', () => {
    const token = extractTokenFromProtocol(['token_']);
    expect(token).toBe('');
  });
});
