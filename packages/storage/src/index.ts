// ============================================================
// Forge Storage Service — S3-compatible Storage + Metadata
// ============================================================
//
// Features:
//  - S3-compatible client for RustFS integration
//  - Presigned upload URL generation
//  - Presigned download URL generation
//  - Metadata CRUD in Postgres (bucket, path, size, content_type)
//  - Bucket management CRUD
//  - CORS configuration
//
// ============================================================

import { generateUploadUrl, generateDownloadUrl, checkS3Connection } from './s3.js';
import { createMetadata, upsertMetadata, getMetadata, listMetadata, deleteMetadata } from './metadata.js';
import { createBucket as createBucketRecord, getBucket, listBuckets as listBucketRecords, updateBucket, deleteBucket as deleteBucketRecord } from './buckets.js';
import { setDefaultCors, setRestrictedCors, getCorsRules } from './cors.js';
import { ForgeStorageError, ValidationError } from './errors.js';

// ============================================================
// Configuration
// ============================================================

const PORT = parseInt(process.env.PORT || '3004', 10);
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB default

// ============================================================
// Public API
// ============================================================

export {
  // S3 operations
  generateUploadUrl,
  generateDownloadUrl,
  checkS3Connection,
  getS3Client,
  resetS3Client,
} from './s3.js';

export {
  createMetadata,
  upsertMetadata,
  getMetadata,
  listMetadata,
  deleteMetadata,
} from './metadata.js';

export {
  createBucketRecord,
  getBucket,
  listBucketRecords,
  updateBucket,
  deleteBucketRecord,
  setDefaultCors,
  setRestrictedCors,
  getCorsRules,
} from './buckets.js';

export {
  ForgeStorageError,
  ValidationError,
  NotFoundError,
} from './errors.js';

// ============================================================
// Storage API — High-level operations
// ============================================================

export interface UploadUrlResult {
  url: string;
  method: 'PUT';
  expires_in: number;
}

export interface DownloadUrlResult {
  url: string;
  method: 'GET';
  expires_in: number;
}

/**
 * Generate a presigned upload URL and record metadata
 */
export async function createUploadUrl(
  tenantId: string,
  bucket: string,
  path: string,
  contentType: string,
  sizeBytes: number,
): Promise<UploadUrlResult> {
  // Validate
  if (!bucket || !path) {
    throw new ValidationError('bucket and path are required');
  }

  if (sizeBytes > MAX_FILE_SIZE) {
    throw new ValidationError(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
  }

  // Check if bucket exists (optional, based on config)
  const bucketRecord = await getBucket(tenantId, bucket);
  if (!bucketRecord) {
    // Auto-create bucket record
    await createBucketRecord({ tenant_id: tenantId, name: bucket });
  }

  // Generate presigned URL
  const url = await generateUploadUrl(bucket, path, contentType);

  // Record metadata
  await upsertMetadata({
    tenant_id: tenantId,
    bucket,
    path,
    content_type: contentType || 'application/octet-stream',
    size_bytes: sizeBytes || 0,
  });

  return {
    url,
    method: 'PUT',
    expires_in: 900,
  };
}

/**
 * Generate a presigned download URL
 */
export async function createDownloadUrl(
  tenantId: string,
  bucket: string,
  path: string,
): Promise<DownloadUrlResult> {
  if (!bucket || !path) {
    throw new ValidationError('bucket and path are required');
  }

  // Verify metadata exists
  const meta = await getMetadata(tenantId, bucket, path);
  if (!meta) {
    throw new ForgeStorageError(404, 'NOT_FOUND', 'File not found');
  }

  const url = await generateDownloadUrl(bucket, path);

  return {
    url,
    method: 'GET',
    expires_in: 3600,
  };
}

/**
 * List files in a bucket
 */
export async function listFiles(
  tenantId: string,
  bucket?: string,
  limit = 50,
  offset = 0,
) {
  return listMetadata(tenantId, bucket, limit, offset);
}

/**
 * Delete a file and its metadata
 */
export async function deleteFile(
  tenantId: string,
  bucket: string,
  path: string,
): Promise<boolean> {
  return deleteMetadata(tenantId, bucket, path);
}

// ============================================================
// HTTP Server (optional — can be used standalone or via Gateway)
// ============================================================

const isMainModule =
  process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('dist/index.js');

if (isMainModule) {
  // Fastify server
  const Fastify = (await import('fastify')).default;
  const app = Fastify({
    logger: { level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' },
  });

  // CORS
  app.addHook('onRequest', async (_request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (_request.method === 'OPTIONS') {
      reply.code(204);
      return reply.send('');
    }
  });

  // Health
  app.get('/health', async () => {
    const s3Ok = await checkS3Connection();
    const checks = { s3: s3Ok ? 'ok' : 'error' };
    return {
      success: true,
      status: s3Ok ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };
  });

  // Upload URL
  app.post('/v1/upload-url', async (request, reply) => {
    const { bucket, path, content_type, size_bytes, tenant_id } = request.body as Record<
      string,
      unknown
    >;

    try {
      const result = await createUploadUrl(
        (tenant_id as string) || '',
        bucket as string,
        path as string,
        (content_type as string) || 'application/octet-stream',
        (size_bytes as number) || 0,
      );
      return reply.send({ success: true, data: result });
    } catch (err) {
      if (err instanceof ForgeStorageError || err instanceof ValidationError) {
        return reply.status(err.statusCode || 400).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // Download URL
  app.get('/v1/download-url', async (request, reply) => {
    const { bucket, path, tenant_id } = request.query as Record<string, string>;

    try {
      const result = await createDownloadUrl(tenant_id || '', bucket, path);
      return reply.send({ success: true, data: result });
    } catch (err) {
      if (err instanceof ForgeStorageError || err instanceof ValidationError) {
        return reply.status(err.statusCode || 400).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // List files
  app.get('/v1/files', async (request, reply) => {
    const { tenant_id, bucket, limit, offset } = request.query as Record<string, string>;
    try {
      const result = await listFiles(
        tenant_id || '',
        bucket,
        parseInt(limit || '50'),
        parseInt(offset || '0'),
      );
      return reply.send({ success: true, data: result.records, total: result.total });
    } catch (err) {
      if (err instanceof ForgeStorageError || err instanceof ValidationError) {
        return reply.status(err.statusCode || 400).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`📦 Storage service listening on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
