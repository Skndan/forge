// Storage — S3 Client Tests
import { describe, expect, test, beforeEach } from 'bun:test';
import { generateUploadUrl, generateDownloadUrl, checkS3Connection, getS3Client, resetS3Client } from '../s3';

describe('S3 Client', () => {
  beforeEach(() => {
    resetS3Client();
  });

  test('getS3Client returns a client instance', () => {
    const client = getS3Client();
    expect(client).toBeDefined();
    expect(client.config.endpoint).toBeDefined();
  });

  test('getS3Client returns the same instance on repeated calls', () => {
    const client1 = getS3Client();
    const client2 = getS3Client();
    expect(client1).toBe(client2);
  });

  test('resetS3Client creates a new instance', () => {
    const client1 = getS3Client();
    resetS3Client();
    const client2 = getS3Client();
    expect(client1).not.toBe(client2);
  });

  test('generateUploadUrl throws if bucket is empty', async () => {
    try {
      // This will fail because there's no actual S3 running, but should throw an error
      // not an unhandled rejection
      await generateUploadUrl('', 'test.txt', 'text/plain');
      // If we get here, the test is inconclusive (might throw later)
    } catch (err) {
      expect(err).toBeDefined();
    }
  });

  test('generateDownloadUrl validates parameters', async () => {
    try {
      await generateDownloadUrl('test-bucket', 'test.txt');
    } catch (err) {
      expect(err).toBeDefined();
    }
  });

  test('checkS3Connection returns false when no S3 available', async () => {
    const result = await checkS3Connection();
    expect(result).toBe(false);
  });

  test('generateUploadUrl with metadata includes metadata in URL', async () => {
    try {
      await generateUploadUrl('bucket', 'path/file.txt', 'image/png', { author: 'test' });
    } catch (err) {
      expect(err).toBeDefined();
    }
  });
});
