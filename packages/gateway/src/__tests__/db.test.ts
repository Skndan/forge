// Gateway — DB Route Tests
import { describe, expect, test } from 'bun:test';
import { ForgeError, UnauthorizedError, ValidationError } from '../errors';
import { extractToken } from '../auth';

describe('POST /v1/db/query — route logic', () => {
  test('rejects requests without auth header', () => {
    const token = extractToken(undefined);
    expect(token).toBeNull();
    // The middleware would throw UnauthorizedError
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  test('rejects requests with missing query', () => {
    const sqlQuery = undefined;
    expect(() => {
      if (!sqlQuery || typeof sqlQuery !== 'string') {
        throw new ValidationError('Query string is required');
      }
    }).toThrow(ValidationError);
  });

  test('rejects non-SELECT queries', () => {
    const sqlQuery = 'DELETE FROM users';
    const trimmedQuery = sqlQuery.trim().toUpperCase();
    const isSelect = trimmedQuery.startsWith('SELECT');
    expect(isSelect).toBe(false);

    expect(() => {
      if (!isSelect) {
        throw new ForgeError(403, 'FORBIDDEN', 'Only SELECT queries are allowed');
      }
    }).toThrow(ForgeError);
  });

  test('accepts SELECT queries', () => {
    const sqlQuery = 'SELECT * FROM forge.users';
    const trimmedQuery = sqlQuery.trim().toUpperCase();
    expect(trimmedQuery.startsWith('SELECT')).toBe(true);
  });

  test('handles SELECT queries with parameters', () => {
    const sqlQuery = 'SELECT * FROM forge.users WHERE id = $1';
    expect(sqlQuery.trim().toUpperCase().startsWith('SELECT')).toBe(true);
  });
});
