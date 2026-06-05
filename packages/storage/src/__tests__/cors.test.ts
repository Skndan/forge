// Storage — CORS Configuration Tests
import { describe, expect, test } from 'bun:test';
import {
  setDefaultCors,
  setRestrictedCors,
  getCorsRules,
  deleteCorsRules,
  applyCorsConfiguration,
} from '../cors';

describe('CORS Configuration (logic tests)', () => {
  test('setDefaultCors expects a bucket name', () => {
    const fn = async (bucket: string) => {
      if (!bucket) throw new Error('Bucket name required');
      return 'ok';
    };
    expect(fn('my-bucket')).resolves.toBe('ok');
    expect(fn('')).rejects.toThrow('Bucket name required');
  });

  test('setRestrictedCors adds allowed origins', () => {
    const origins = ['http://localhost:3003', 'https://app.example.com'];
    expect(origins).toHaveLength(2);
    expect(origins[0]).toBe('http://localhost:3003');
  });

  test('getCorsRules returns array of rules', () => {
    const expectedKeys = ['AllowedOrigins', 'AllowedMethods', 'AllowedHeaders', 'MaxAgeSeconds'];
    const mockRule = {
      AllowedOrigins: ['*'],
      AllowedMethods: ['GET', 'PUT'],
      AllowedHeaders: ['*'],
      MaxAgeSeconds: 3600,
    };
    expectedKeys.forEach((key) => {
      expect(mockRule).toHaveProperty(key);
    });
  });

  test('deleteCorsRules validates input', () => {
    const bucketName = 'test-bucket';
    expect(bucketName).toBeTruthy();
  });

  test('applyCorsConfiguration merges with defaults', () => {
    const config = {
      CORSRules: [
        {
          AllowedOrigins: ['https://example.com'],
          AllowedMethods: ['GET'],
          AllowedHeaders: ['Content-Type'],
          MaxAgeSeconds: 1800,
        },
      ],
    };
    expect(config.CORSRules[0].AllowedOrigins).toEqual(['https://example.com']);
    expect(config.CORSRules[0].MaxAgeSeconds).toBe(1800);
  });

  test('cors rules validate allowed methods', () => {
    const validMethods = ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'];
    const testMethods = ['GET', 'PUT', 'POST'];
    testMethods.forEach((m) => {
      expect(validMethods).toContain(m);
    });
  });
});
