// Storage — Metadata CRUD in Postgres
// Manages the storage_metadata table for file tracking

import postgres from 'postgres';

// ============================================================
// Types
// ============================================================

export interface StorageRecord {
  id: string;
  tenant_id: string;
  bucket: string;
  path: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMetadataInput {
  tenant_id: string;
  bucket: string;
  path: string;
  content_type: string;
  size_bytes: number;
}

export interface UpdateMetadataInput {
  content_type?: string;
  size_bytes?: number;
}

// ============================================================
// Postgres Connection
// ============================================================

function getSql(): ReturnType<typeof postgres> {
  return postgres(process.env.POSTGRES_URL || 'postgres://forge:forge_dev_password_change_me@localhost:5432/forge');
}

// ============================================================
// CRUD Operations
// ============================================================

export async function createMetadata(input: CreateMetadataInput): Promise<StorageRecord> {
  const sql = getSql();
  try {
    const [record] = await sql<StorageRecord[]>`
      INSERT INTO forge.storage_metadata (tenant_id, bucket, path, content_type, size_bytes)
      VALUES (
        ${input.tenant_id}::uuid,
        ${input.bucket},
        ${input.path},
        ${input.content_type},
        ${input.size_bytes}
      )
      RETURNING *
    `;
    return record;
  } finally {
    await sql.end();
  }
}

export async function upsertMetadata(input: CreateMetadataInput): Promise<StorageRecord> {
  const sql = getSql();
  try {
    const [record] = await sql<StorageRecord[]>`
      INSERT INTO forge.storage_metadata (tenant_id, bucket, path, content_type, size_bytes)
      VALUES (
        ${input.tenant_id}::uuid,
        ${input.bucket},
        ${input.path},
        ${input.content_type},
        ${input.size_bytes}
      )
      ON CONFLICT (tenant_id, bucket, path) DO UPDATE
      SET content_type = EXCLUDED.content_type,
          size_bytes = EXCLUDED.size_bytes,
          updated_at = now()
      RETURNING *
    `;
    return record;
  } finally {
    await sql.end();
  }
}

export async function getMetadata(
  tenantId: string,
  bucket: string,
  path: string,
): Promise<StorageRecord | null> {
  const sql = getSql();
  try {
    const [record] = await sql<StorageRecord[]>`
      SELECT * FROM forge.storage_metadata
      WHERE tenant_id = ${tenantId}::uuid
        AND bucket = ${bucket}
        AND path = ${path}
    `;
    return record || null;
  } finally {
    await sql.end();
  }
}

export async function listMetadata(
  tenantId: string,
  bucket?: string,
  limit = 50,
  offset = 0,
): Promise<{ records: StorageRecord[]; total: number }> {
  const sql = getSql();
  try {
    let records: StorageRecord[];
    let total: number;

    if (bucket) {
      [records, [{ count }]] = await Promise.all([
        sql<StorageRecord[]>`
          SELECT * FROM forge.storage_metadata
          WHERE tenant_id = ${tenantId}::uuid AND bucket = ${bucket}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`SELECT COUNT(*)::int as count FROM forge.storage_metadata
            WHERE tenant_id = ${tenantId}::uuid AND bucket = ${bucket}`,
      ]);
      total = count as number;
    } else {
      [records, [{ count }]] = await Promise.all([
        sql<StorageRecord[]>`
          SELECT * FROM forge.storage_metadata
          WHERE tenant_id = ${tenantId}::uuid
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`SELECT COUNT(*)::int as count FROM forge.storage_metadata
            WHERE tenant_id = ${tenantId}::uuid`,
      ]);
      total = count as number;
    }

    return { records, total };
  } finally {
    await sql.end();
  }
}

export async function updateMetadata(
  tenantId: string,
  bucket: string,
  path: string,
  input: UpdateMetadataInput,
): Promise<StorageRecord | null> {
  const sql = getSql();
  try {
    const [record] = await sql<StorageRecord[]>`
      UPDATE forge.storage_metadata
      SET
        content_type = COALESCE(${input.content_type}, content_type),
        size_bytes = COALESCE(${input.size_bytes}, size_bytes),
        updated_at = now()
      WHERE tenant_id = ${tenantId}::uuid
        AND bucket = ${bucket}
        AND path = ${path}
      RETURNING *
    `;
    return record || null;
  } finally {
    await sql.end();
  }
}

export async function deleteMetadata(
  tenantId: string,
  bucket: string,
  path: string,
): Promise<boolean> {
  const sql = getSql();
  try {
    const result = await sql`
      DELETE FROM forge.storage_metadata
      WHERE tenant_id = ${tenantId}::uuid
        AND bucket = ${bucket}
        AND path = ${path}
    `;
    return result.count > 0;
  } finally {
    await sql.end();
  }
}
