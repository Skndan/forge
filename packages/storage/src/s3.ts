// Storage — S3-compatible client for RustFS
// Provides operations against any S3-compatible store

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListBucketsCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  HeadBucketCommand,
  type Bucket,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ============================================================
// S3 Client Factory
// ============================================================

let clientInstance: S3Client | null = null;

function getS3Config() {
  return {
    endpoint: process.env.RUSTFS_ENDPOINT || 'http://rustfs:9000',
    region: process.env.RUSTFS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.RUSTFS_ACCESS_KEY || 'forge_access_key',
      secretAccessKey: process.env.RUSTFS_SECRET_KEY || 'forge_secret_key',
    },
    forcePathStyle: true, // Required for S3-compatible stores like RustFS/MinIO
  };
}

export function getS3Client(): S3Client {
  if (!clientInstance) {
    const config = getS3Config();
    clientInstance = new S3Client(config);
  }
  return clientInstance;
}

export function resetS3Client(): void {
  if (clientInstance) {
    clientInstance.destroy();
    clientInstance = null;
  }
}

// ============================================================
// Presigned URL Generation
// ============================================================

export async function generateUploadUrl(
  bucket: string,
  path: string,
  contentType: string,
  expiresIn = 900, // 15 minutes
): Promise<string> {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: path,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn });
}

export async function generateDownloadUrl(
  bucket: string,
  path: string,
  expiresIn = 3600, // 1 hour
): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: path,
  });

  return getSignedUrl(client, command, { expiresIn });
}

export async function generateUploadUrlWithMetadata(
  bucket: string,
  path: string,
  contentType: string,
  metadata?: Record<string, string>,
  expiresIn = 900,
): Promise<string> {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: path,
    ContentType: contentType,
    Metadata: metadata,
  });

  return getSignedUrl(client, command, { expiresIn });
}

// ============================================================
// Health Check
// ============================================================

export async function checkS3Connection(): Promise<boolean> {
  try {
    const client = getS3Client();
    await client.send(new ListBucketsCommand({}));
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Bucket Management
// ============================================================

export async function listBuckets(): Promise<Bucket[]> {
  const client = getS3Client();
  const response = await client.send(new ListBucketsCommand({}));
  return response.Buckets || [];
}

export async function createBucket(name: string, region?: string): Promise<void> {
  const client = getS3Client();
  await client.send(
    new CreateBucketCommand({
      Bucket: name,
      ...(region ? { CreateBucketConfiguration: { LocationConstraint: region } } : {}),
    }),
  );
}

export async function deleteBucket(name: string): Promise<void> {
  const client = getS3Client();
  await client.send(new DeleteBucketCommand({ Bucket: name }));
}

export async function bucketExists(name: string): Promise<boolean> {
  try {
    const client = getS3Client();
    await client.send(new HeadBucketCommand({ Bucket: name }));
    return true;
  } catch {
    return false;
  }
}
