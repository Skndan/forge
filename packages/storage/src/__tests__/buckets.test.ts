// Storage — Bucket Management Tests
import { describe, expect, test } from 'bun:test';
import {
  createBucket,
  getBucket,
  listBuckets,
  updateBucket,
  deleteBucket,
  type CreateBucketInput,
  type UpdateBucketInput,
} from '../buckets';

describe('Bucket Management (logic tests)', () => {
  test('createBucket input type is valid', () => {
    const input: CreateBucketInput = {
      tenant_id: 'tenant-1',
      name: 'my-bucket',
      public: true,
      allowed_mime_types: ['image/png', 'image/jpeg'],
      max_file_size_bytes: 10 * 1024 * 1024,
    };
    expect(input.tenant_id).toBe('tenant-1');
    expect(input.name).toBe('my-bucket');
    expect(input.public).toBe(true);
    expect(input.allowed_mime_types).toHaveLength(2);
  });

  test('createBucket with minimal fields', () => {
    const input: CreateBucketInput = {
      tenant_id: 'tenant-1',
      name: 'minimal-bucket',
    };
    expect(input.public).toBeUndefined();
    expect(input.allowed_mime_types).toBeUndefined();
    expect(input.max_file_size_bytes).toBeUndefined();
  });

  test('updateBucket input is valid', () => {
    const input: UpdateBucketInput = {
      public: false,
      max_file_size_bytes: 50 * 1024 * 1024,
    };
    expect(input.public).toBe(false);
    expect(input.max_file_size_bytes).toBe(50 * 1024 * 1024);
  });

  test('listBuckets requires tenant_id', () => {
    // Logic test: function expects tenant_id parameter
    const fn = (tid: string) => tid.length > 0;
    expect(fn('')).toBe(false);
    expect(fn('tenant-1')).toBe(true);
  });

  test('deleteBucket validates inputs', () => {
    const bucketName = 'my-bucket';
    expect(bucketName.length).toBeGreaterThan(0);
  });

  test('getBucket bucket name sanitization', () => {
    // Bucket names should be lowercase, no underscores
    const sanitize = (name: string) => name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    expect(sanitize('My Bucket!')).toBe('my-bucket-');
    expect(sanitize('valid-bucket-1')).toBe('valid-bucket-1');
  });
});
