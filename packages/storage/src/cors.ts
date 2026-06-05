// Storage — CORS Configuration for S3-compatible storage
// Manages CORS rules for RustFS buckets

import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
  DeleteBucketCorsCommand,
  type CORSConfiguration,
  type CORSRule,
} from '@aws-sdk/client-s3';
import { getS3Client } from './s3.js';

// ============================================================
// Default CORS Rules
// ============================================================

const DEFAULT_CORS_RULES: CORSRule[] = [
  {
    AllowedOrigins: ['*'],
    AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
    AllowedHeaders: ['*'],
    ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
    MaxAgeSeconds: 3600,
  },
];

const RESTRICTED_CORS_RULES: CORSRule[] = [
  {
    AllowedOrigins: ['http://localhost:3003', 'https://dashboard.forge.app'],
    AllowedMethods: ['GET', 'PUT', 'POST'],
    AllowedHeaders: ['Content-Type', 'Authorization', 'x-amz-acl'],
    ExposeHeaders: ['ETag', 'Content-Length'],
    MaxAgeSeconds: 3600,
  },
];

// ============================================================
// CORS Operations
// ============================================================

export async function setDefaultCors(bucket: string): Promise<void> {
  const client = getS3Client();
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: DEFAULT_CORS_RULES,
      },
    }),
  );
}

export async function setRestrictedCors(
  bucket: string,
  allowedOrigins?: string[],
): Promise<void> {
  const client = getS3Client();

  let rules: CORSRule[];
  if (allowedOrigins) {
    rules = [
      {
        AllowedOrigins: allowedOrigins,
        AllowedMethods: ['GET', 'PUT', 'POST'],
        AllowedHeaders: ['Content-Type', 'Authorization', 'x-amz-acl'],
        ExposeHeaders: ['ETag', 'Content-Length'],
        MaxAgeSeconds: 3600,
      },
    ];
  } else {
    rules = RESTRICTED_CORS_RULES;
  }

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: { CORSRules: rules },
    }),
  );
}

export async function getCorsRules(bucket: string): Promise<CORSRule[]> {
  const client = getS3Client();
  try {
    const response = await client.send(
      new GetBucketCorsCommand({ Bucket: bucket }),
    );
    return response.CORSRules || [];
  } catch (err) {
    if ((err as Error).name === 'NoSuchCORSConfiguration') {
      return [];
    }
    throw err;
  }
}

export async function deleteCorsRules(bucket: string): Promise<void> {
  const client = getS3Client();
  try {
    await client.send(new DeleteBucketCorsCommand({ Bucket: bucket }));
  } catch (err) {
    if ((err as Error).name !== 'NoSuchCORSConfiguration') {
      throw err;
    }
  }
}

export async function applyCorsConfiguration(
  bucket: string,
  configuration: CORSConfiguration,
): Promise<void> {
  const client = getS3Client();
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: configuration,
    }),
  );
}
