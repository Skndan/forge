// Storage — Bucket Management CRUD
// Manages the storage_buckets table for tenant-level bucket configuration

import postgres from 'postgres';

// ============================================================
// Types
// ============================================================

export interface BucketRecord {
  id: string;
  tenant_id: string;
  name: string;
  public: boolean;
  allowed_mime_types: string[] | null;
  max_file_size_bytes: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBucketInput {
  tenant_id: string;
  name: string;
  public?: boolean;
  allowed_mime_types?: string[];
  max_file_size_bytes?: number;
}

export interface UpdateBucketInput {
  public?: boolean;
  allowed_mime_types?: string[];
  max_file_size_bytes?: number;
}

// ============================================================
// Postgres Connection
// ============================================================

function getSql(): ReturnType<typeof postgres> {
  return postgres(process.env.POSTGRES_URL || 'postgres://forge:forge_dev_password_change_me@localhost:5432/forge');
}

// ============================================================
// Bucket CRUD
// ============================================================

export async function createBucket(input: CreateBucketInput): Promise<BucketRecord> {
  const sql = getSql();
  try {
    const [record] = await sql<BucketRecord[]>`
      INSERT INTO forge.storage_buckets (tenant_id, name, public, allowed_mime_types, max_file_size_bytes)
      VALUES (
        ${input.tenant_id}::uuid,
        ${input.name},
        ${input.public ?? false},
        ${input.allowed_mime_types ?? null},
        ${input.max_file_size_bytes ?? null}
      )
      RETURNING *
    `;
    return record;
  } finally {
    await sql.end();
  }
}

export async function getBucket(
  tenantId: string,
  name: string,
): Promise<BucketRecord | null> {
  const sql = getSql();
  try {
    const [record] = await sql<BucketRecord[]>`
      SELECT * FROM forge.storage_buckets
      WHERE tenant_id = ${tenantId}::uuid AND name = ${name}
    `;
    return record || null;
  } finally {
    await sql.end();
  }
}

export async function listBuckets(tenantId: string): Promise<BucketRecord[]> {
  const sql = getSql();
  try {
    return await sql<BucketRecord[]>`
      SELECT * FROM forge.storage_buckets
      WHERE tenant_id = ${tenantId}::uuid
      ORDER BY created_at DESC
    `;
  } finally {
    await sql.end();
  }
}

export async function updateBucket(
  tenantId: string,
  name: string,
  input: UpdateBucketInput,
): Promise<BucketRecord | null> {
  const sql = getSql();
  try {
    const [record] = await sql<BucketRecord[]>`
      UPDATE forge.storage_buckets
      SET
        public = COALESCE(${input.public}, public),
        allowed_mime_types = COALESCE(${input.allowed_mime_types}, allowed_mime_types),
        max_file_size_bytes = COALESCE(${input.max_file_size_bytes}, max_file_size_bytes),
        updated_at = now()
      WHERE tenant_id = ${tenantId}::uuid AND name = ${name}
      RETURNING *
    `;
    return record || null;
  } finally {
    await sql.end();
  }
}

export async function deleteBucket(
  tenantId: string,
  name: string,
): Promise<boolean> {
  const sql = getSql();
  try {
    const result = await sql`
      DELETE FROM forge.storage_buckets
      WHERE tenant_id = ${tenantId}::uuid AND name = ${name}
    `;
    return result.count > 0;
  } finally {
    await sql.end();
  }
}
