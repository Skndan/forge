// Gateway — Storage Routes
// POST /v1/storage/upload-url, GET /v1/storage/download-url
import type { FastifyInstance } from 'fastify';
import { jwtVerifyMiddleware } from '../middleware/auth.js';
import { ForgeError, ValidationError } from '../errors.js';
import type { StorageUploadUrlRequest, StorageDownloadUrlRequest } from '@forge/types';

function getRustFsEndpoint(): string {
  return process.env.RUSTFS_ENDPOINT || 'http://rustfs:9000';
}

async function generatePresignedUrl(
  method: 'PUT' | 'GET',
  bucket: string,
  path: string,
  contentType?: string,
): Promise<string> {
  const endpoint = getRustFsEndpoint();
  const accessKey = process.env.RUSTFS_ACCESS_KEY || 'forge_access_key';
  const secretKey = process.env.RUSTFS_SECRET_KEY || 'forge_secret_key';
  const region = process.env.RUSTFS_REGION || 'us-east-1';

  const url = new URL(`${endpoint}/${bucket}/${path}`);

  // For now, return a simple signed URL using query params
  // RustFS uses S3-compatible presigned URLs
  url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  url.searchParams.set('X-Amz-Credential', `${accessKey}/${region}/s3/aws4_request`);
  url.searchParams.set('X-Amz-Expires', method === 'PUT' ? '900' : '3600');
  url.searchParams.set('X-Amz-Date', new Date().toISOString().replace(/[:-]/g, '').split('.')[0]);
  if (contentType) {
    url.searchParams.set('X-Amz-Content-Type', contentType);
  }

  return url.toString();
}

export async function registerStorageRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/storage/upload-url
  app.post(
    '/v1/storage/upload-url',
    { preHandler: [jwtVerifyMiddleware] },
    async (request, reply) => {
      const { bucket, path, content_type, size_bytes } = request.body as StorageUploadUrlRequest;

      if (!bucket || !path) {
        throw new ValidationError('bucket and path are required');
      }

      if (size_bytes && size_bytes > 100 * 1024 * 1024) {
        throw new ValidationError('File size exceeds 100MB limit');
      }

      const url = await generatePresignedUrl('PUT', bucket, path, content_type);

      // Record metadata in Postgres
      const { default: postgres } = await import('postgres');
      const sql = postgres(process.env.POSTGRES_URL || '');

      try {
        await sql`
          INSERT INTO forge.storage_metadata (tenant_id, bucket, path, content_type, size_bytes)
          VALUES (
            ${request.currentUser!.tenant_id || ''}::uuid,
            ${bucket},
            ${path},
            ${content_type || 'application/octet-stream'},
            ${size_bytes || 0}
          )
          ON CONFLICT (tenant_id, bucket, path) DO UPDATE
          SET content_type = EXCLUDED.content_type,
              size_bytes = EXCLUDED.size_bytes,
              updated_at = now()
        `;
      } finally {
        await sql.end();
      }

      return reply.send({
        success: true,
        data: {
          url,
          method: 'PUT',
          expires_in: 900,
        },
      });
    },
  );

  // GET /v1/storage/download-url
  app.get(
    '/v1/storage/download-url',
    { preHandler: [jwtVerifyMiddleware] },
    async (request, reply) => {
      const { bucket, path } = request.query as unknown as StorageDownloadUrlRequest;

      if (!bucket || !path) {
        throw new ValidationError('bucket and path query params are required');
      }

      const url = await generatePresignedUrl('GET', bucket, path);

      return reply.send({
        success: true,
        data: {
          url,
          method: 'GET',
          expires_in: 3600,
        },
      });
    },
  );
}
