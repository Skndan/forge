// Storage — Error Class Tests
import { describe, expect, test } from 'bun:test';
import { ForgeStorageError, ValidationError, NotFoundError } from '../errors';

describe('ForgeStorageError', () => {
  test('creates error with status code and code', () => {
    const err = new ForgeStorageError(500, 'INTERNAL', 'Something broke');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL');
    expect(err.message).toBe('Something broke');
    expect(err.name).toBe('ForgeStorageError');
  });

  test('creates error with details', () => {
    const details = { field: 'bucket' };
    const err = new ForgeStorageError(400, 'BAD_REQUEST', 'Bad request', details);
    expect(err.details).toEqual(details);
  });
});

describe('ValidationError', () => {
  test('creates with default message', () => {
    const err = new ValidationError();
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Validation error');
    expect(err.name).toBe('ValidationError');
  });

  test('creates with custom message', () => {
    const err = new ValidationError('bucket and path are required');
    expect(err.message).toBe('bucket and path are required');
  });

  test('is instance of ForgeStorageError', () => {
    const err = new ValidationError();
    expect(err instanceof ForgeStorageError).toBe(true);
  });
});

describe('NotFoundError', () => {
  test('creates with default message', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Not found');
    expect(err.name).toBe('NotFoundError');
  });

  test('creates with custom message', () => {
    const err = new NotFoundError('File not found in bucket');
    expect(err.message).toBe('File not found in bucket');
  });

  test('is instance of ForgeStorageError', () => {
    const err = new NotFoundError();
    expect(err instanceof ForgeStorageError).toBe(true);
  });
});
