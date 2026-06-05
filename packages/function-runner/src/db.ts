// Function Runner — Database Utilities
// ============================================================

import postgres from 'postgres';
import type { FunctionDefinition } from '@forge/types';
import { config } from './config.js';

let _sql: postgres.Sql<Record<string, unknown>> | null = null;

export function getDb(): postgres.Sql<Record<string, unknown>> {
  if (!_sql) {
    _sql = postgres(config.postgresUrl, {
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
    });
  }
  return _sql;
}

export async function closeDb(): Promise<void> {
  if (_sql) {
    await _sql.end();
    _sql = null;
  }
}

// ── Function Definitions ──────────────────────────────────────

export interface FunctionRow {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  runtime: 'bun' | 'node';
  source: string;
  entrypoint: string;
  env_vars: Record<string, string>;
  timeout_ms: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function rowToDefinition(row: FunctionRow): FunctionDefinition {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    slug: row.slug,
    runtime: row.runtime,
    source: row.source,
    entrypoint: row.entrypoint,
    env_vars: row.env_vars,
    timeout_ms: row.timeout_ms,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getFunctionById(functionId: string): Promise<FunctionDefinition | null> {
  const sql = getDb();
  const rows = await sql<FunctionRow[]>`
    SELECT id, tenant_id, name, slug, runtime, source, entrypoint, env_vars, timeout_ms, is_active, created_at, updated_at
    FROM forge.function_definitions
    WHERE id = ${sql(functionId)}::uuid
      AND is_active = true
    LIMIT 1
  `;
  return rows.length > 0 ? rowToDefinition(rows[0]) : null;
}

export async function getFunctionByTenantAndSlug(
  tenantId: string,
  slug: string,
): Promise<FunctionDefinition | null> {
  const sql = getDb();
  const rows = await sql<FunctionRow[]>`
    SELECT id, tenant_id, name, slug, runtime, source, entrypoint, env_vars, timeout_ms, is_active, created_at, updated_at
    FROM forge.function_definitions
    WHERE tenant_id = ${sql(tenantId)}::uuid
      AND slug = ${slug}
      AND is_active = true
    LIMIT 1
  `;
  return rows.length > 0 ? rowToDefinition(rows[0]) : null;
}

export async function listFunctions(tenantId: string): Promise<FunctionDefinition[]> {
  const sql = getDb();
  const rows = await sql<FunctionRow[]>`
    SELECT id, tenant_id, name, slug, runtime, source, entrypoint, env_vars, timeout_ms, is_active, created_at, updated_at
    FROM forge.function_definitions
    WHERE tenant_id = ${sql(tenantId)}::uuid
    ORDER BY created_at DESC
  `;
  return rows.map(rowToDefinition);
}

export async function createFunction(
  tenantId: string,
  name: string,
  slug: string,
  source: string,
  entrypoint: string,
  envVars: Record<string, string>,
  timeoutMs: number,
): Promise<FunctionDefinition> {
  const sql = getDb();
  const rows = await sql<FunctionRow[]>`
    INSERT INTO forge.function_definitions (tenant_id, name, slug, runtime, source, entrypoint, env_vars, timeout_ms)
    VALUES (
      ${sql(tenantId)}::uuid,
      ${name},
      ${slug},
      'bun',
      ${source},
      ${entrypoint},
      ${sql.json(envVars)},
      ${timeoutMs}
    )
    RETURNING id, tenant_id, name, slug, runtime, source, entrypoint, env_vars, timeout_ms, is_active, created_at, updated_at
  `;
  return rowToDefinition(rows[0]);
}

export async function updateFunction(
  functionId: string,
  tenantId: string,
  updates: Partial<{
    name: string;
    slug: string;
    source: string;
    entrypoint: string;
    env_vars: Record<string, string>;
    timeout_ms: number;
    is_active: boolean;
  }>,
): Promise<FunctionDefinition | null> {
  const sql = getDb();
  const setClauses: string[] = [];

  if (updates.name !== undefined) {
    setClauses.push(`name = ${sql(updates.name)}`);
  }
  if (updates.slug !== undefined) {
    setClauses.push(`slug = ${sql(updates.slug)}`);
  }
  if (updates.source !== undefined) {
    setClauses.push(`source = ${sql(updates.source)}`);
  }
  if (updates.entrypoint !== undefined) {
    setClauses.push(`entrypoint = ${sql(updates.entrypoint)}`);
  }
  if (updates.env_vars !== undefined) {
    setClauses.push(`env_vars = ${sql.json(updates.env_vars)}`);
  }
  if (updates.timeout_ms !== undefined) {
    setClauses.push(`timeout_ms = ${updates.timeout_ms}`);
  }
  if (updates.is_active !== undefined) {
    setClauses.push(`is_active = ${updates.is_active}`);
  }

  if (setClauses.length === 0) return null;

  const rows = await sql<FunctionRow[]>`
    UPDATE forge.function_definitions
    SET ${sql.unsafe(setClauses.join(', '))}
    WHERE id = ${sql(functionId)}::uuid
      AND tenant_id = ${sql(tenantId)}::uuid
    RETURNING id, tenant_id, name, slug, runtime, source, entrypoint, env_vars, timeout_ms, is_active, created_at, updated_at
  `;
  return rows.length > 0 ? rowToDefinition(rows[0]) : null;
}

export async function deleteFunction(
  functionId: string,
  tenantId: string,
): Promise<boolean> {
  const sql = getDb();
  const result = await sql`
    DELETE FROM forge.function_definitions
    WHERE id = ${sql(functionId)}::uuid
      AND tenant_id = ${sql(tenantId)}::uuid
  `;
  return result.count > 0;
}

// ── Function Execution Logs ───────────────────────────────────

export interface FunctionLog {
  id: string;
  function_id: string;
  tenant_id: string;
  invocation_id: string;
  log_type: 'stdout' | 'stderr';
  message: string;
  timestamp: string;
}

export async function insertLog(
  functionId: string,
  tenantId: string,
  invocationId: string,
  logType: 'stdout' | 'stderr',
  message: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO forge.function_logs (function_id, tenant_id, invocation_id, log_type, message)
    VALUES (
      ${sql(functionId)}::uuid,
      ${sql(tenantId)}::uuid,
      ${invocationId},
      ${logType},
      ${message}
    )
  `;
}

export async function insertLogBatch(
  logs: Array<{
    function_id: string;
    tenant_id: string;
    invocation_id: string;
    log_type: 'stdout' | 'stderr';
    message: string;
  }>,
): Promise<void> {
  if (logs.length === 0) return;
  for (const log of logs) {
    await insertLog(log.function_id, log.tenant_id, log.invocation_id, log.log_type, log.message);
  }
}

export async function getLogsByInvocation(
  invocationId: string,
): Promise<FunctionLog[]> {
  const sql = getDb();
  return await sql<FunctionLog[]>`
    SELECT id, function_id, tenant_id, invocation_id, log_type, message, timestamp
    FROM forge.function_logs
    WHERE invocation_id = ${invocationId}
    ORDER BY timestamp ASC
  `;
}

export async function getLogsByFunction(
  functionId: string,
  tenantId: string,
  limit = 100,
  offset = 0,
): Promise<{ logs: FunctionLog[]; total: number }> {
  const sql = getDb();
  const [logs, countResult] = await Promise.all([
    sql<FunctionLog[]>`
      SELECT id, function_id, tenant_id, invocation_id, log_type, message, timestamp
      FROM forge.function_logs
      WHERE function_id = ${sql(functionId)}::uuid
        AND tenant_id = ${sql(tenantId)}::uuid
      ORDER BY timestamp DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `,
    sql<[{ count: number }]>`
      SELECT COUNT(*) as count
      FROM forge.function_logs
      WHERE function_id = ${sql(functionId)}::uuid
        AND tenant_id = ${sql(tenantId)}::uuid
    `,
  ]);
  return { logs, total: countResult[0].count };
}

// ── Invocation Tracking ──────────────────────────────────────

export interface FunctionInvocation {
  id: string;
  function_id: string;
  tenant_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timed_out';
  input_payload: unknown;
  output_payload: unknown;
  error_message: string | null;
  duration_ms: number;
  created_at: string;
  completed_at: string | null;
}

export async function createInvocation(
  functionId: string,
  tenantId: string,
  payload: unknown,
): Promise<FunctionInvocation> {
  const sql = getDb();
  const rows = await sql<FunctionInvocation[]>`
    INSERT INTO forge.function_invocations (function_id, tenant_id, status, input_payload)
    VALUES (
      ${sql(functionId)}::uuid,
      ${sql(tenantId)}::uuid,
      'pending',
      ${JSON.stringify(payload)}::jsonb
    )
    RETURNING id, function_id, tenant_id, status, input_payload, output_payload, error_message, duration_ms, created_at, completed_at
  `;
  return rows[0];
}

export async function completeInvocation(
  invocationId: string,
  output: unknown,
  durationMs: number,
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE forge.function_invocations
    SET status = 'completed', output_payload = ${JSON.stringify(output)}::jsonb, duration_ms = ${durationMs}, completed_at = now()
    WHERE id = ${sql(invocationId)}::uuid
  `;
}

export async function failInvocation(
  invocationId: string,
  errorMessage: string,
  durationMs: number,
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE forge.function_invocations
    SET status = 'failed', error_message = ${errorMessage}, duration_ms = ${durationMs}, completed_at = now()
    WHERE id = ${sql(invocationId)}::uuid
  `;
}

export async function timeoutInvocation(
  invocationId: string,
  durationMs: number,
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE forge.function_invocations
    SET status = 'timed_out', error_message = 'Execution timed out', duration_ms = ${durationMs}, completed_at = now()
    WHERE id = ${sql(invocationId)}::uuid
  `;
}

export async function getInvocation(
  invocationId: string,
): Promise<FunctionInvocation | null> {
  const sql = getDb();
  const rows = await sql<FunctionInvocation[]>`
    SELECT id, function_id, tenant_id, status, input_payload, output_payload, error_message, duration_ms, created_at, completed_at
    FROM forge.function_invocations
    WHERE id = ${sql(invocationId)}::uuid
    LIMIT 1
  `;
  return rows.length > 0 ? rows[0] : null;
}

export async function cleanExpiredLogs(): Promise<number> {
  const sql = getDb();
  const result = await sql`
    DELETE FROM forge.function_logs
    WHERE timestamp < now() - (${config.logRetentionDays} || 30) * INTERVAL '1 day'
  `;
  return result.count;
}
