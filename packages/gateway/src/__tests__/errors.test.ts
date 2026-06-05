// Gateway — Error Handler Tests
import { describe, expect, test } from 'bun:test';
import { ForgeError, UnauthorizedError, ForbiddenError, NotFoundError, ValidationError, RateLimitedError } from '../errors';

describe('ForgeError', () => {
  test('creates error with correct status and code', () => {
    const err = new ForgeError(400, 'TEST_ERROR', 'Test message', { detail: 'value' });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('TEST_ERROR');
    expect(err.message).toBe('Test message');
    expect(err.details).toEqual({ detail: 'value' });
  });
});

describe('UnauthorizedError', () => {
  test('has 401 status and UNAUTHORIZED code', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  test('accepts custom message', () => {
    const err = new UnauthorizedError('Custom auth error');
    expect(err.message).toBe('Custom auth error');
  });
});

describe('ForbiddenError', () => {
  test('has 403 status and FORBIDDEN code', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });
});

describe('NotFoundError', () => {
  test('has 404 status and NOT_FOUND code', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });
});

describe('ValidationError', () => {
  test('has 400 status and VALIDATION_ERROR code', () => {
    const err = new ValidationError();
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });
});

describe('RateLimitedError', () => {
  test('has 429 status and RATE_LIMITED code', () => {
    const err = new RateLimitedError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMITED');
  });
});
