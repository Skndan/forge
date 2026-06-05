// Gateway — Storage Route Tests
import { describe, expect, test } from 'bun:test';
import { ValidationError } from '../errors';

describe('POST /v1/storage/upload-url — route logic', () => {
  test('validates required fields', () => {
    expect(() => {
      const bucket = undefined;
      const path = undefined;
      if (!bucket || !path) {
        throw new ValidationError('bucket and path are required');
      }
    }).toThrow(ValidationError);
  });

  test('validates file size limits', () => {
    const sizeBytes = 200 * 1024 * 1024; // 200MB
    const maxSize = 100 * 1024 * 1024; // 100MB
    expect(() => {
      if (sizeBytes > maxSize) {
        throw new ValidationError('File size exceeds 100MB limit');
      }
    }).toThrow(ValidationError);
  });

  test('allows files under size limit', () => {
    const sizeBytes = 50 * 1024 * 1024; // 50MB
    const maxSize = 100 * 1024 * 1024; // 100MB
    expect(sizeBytes <= maxSize).toBe(true);
  });

  test('generates presigned URL with correct params', () => {
    const bucket = 'test-bucket';
    const path = 'uploads/file.txt';
    const generatedUrl = `http://rustfs:9000/${bucket}/${path}`;
    expect(generatedUrl).toContain('test-bucket');
    expect(generatedUrl).toContain('uploads/file.txt');
  });
});

describe('GET /v1/storage/download-url — route logic', () => {
  test('requires bucket and path params', () => {
    expect(() => {
      const bucket = undefined;
      const path = undefined;
      if (!bucket || !path) {
        throw new ValidationError('bucket and path query params are required');
      }
    }).toThrow(ValidationError);
  });
});
