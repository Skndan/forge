// Audit Worker — Audit Event Consumer
// Reads from pgmq audit queue and writes to forge.audit_logs table

import postgres from 'postgres';

// ============================================================
// Types
// ============================================================

export interface AuditEvent {
  tenant_id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  ip_address?: string;
  source?: string;
  timestamp?: string;
}

export interface PgmqMessage {
  msg_id: number;
  message: AuditEvent;
}

// ============================================================
// Configuration
// ============================================================

const POLL_INTERVAL_MS = parseInt(process.env.AUDIT_POLL_INTERVAL || '2000', 2000);
const BATCH_SIZE = parseInt(process.env.AUDIT_BATCH_SIZE || '50', 50);

function getSql(): ReturnType<typeof postgres> {
  return postgres(process.env.POSTGRES_URL || 'postgres://forge:forge_dev_password_change_me@localhost:5432/forge', {
    max: 5,
    connection: {
      application_name: 'forge-worker-audit',
    },
  });
}

// ============================================================
// Audit Event Processing
// ============================================================

export function validateAuditEvent(event: AuditEvent): string | null {
  if (!event.tenant_id) return 'tenant_id is required';
  if (!event.actor_id) return 'actor_id is required';
  if (!event.action) return 'action is required';
  if (!event.target_type) return 'target_type is required';
  if (!event.target_id) return 'target_id is required';
  return null;
}

export async function processAuditEvent(sql: ReturnType<typeof postgres>, event: AuditEvent): Promise<boolean> {
  const validationError = validateAuditEvent(event);
  if (validationError) {
    console.warn(`[audit-worker] Validation error: ${validationError}`, event);
    return false;
  }

  try {
    await sql`
      INSERT INTO forge.audit_logs (tenant_id, actor_id, action, target_type, target_id, metadata, ip_address)
      VALUES (
        ${event.tenant_id}::uuid,
        ${event.actor_id}::uuid,
        ${event.action},
        ${event.target_type},
        ${event.target_id},
        ${sql.json(event.metadata || {})},
        ${event.ip_address || null}
      )
    `;
    return true;
  } catch (err) {
    console.error(`[audit-worker] Failed to insert audit log:`, (err as Error).message);
    return false;
  }
}

// ============================================================
// pgmq Fetch (using pgmq.read)
// ============================================================

async function fetchAuditEvents(sql: ReturnType<typeof postgres>): Promise<PgmqMessage[]> {
  try {
    const messages = await sql<PgmqMessage[]>`
      SELECT * FROM pgmq.read('forge_audit_log', ${BATCH_SIZE}, 30)
    `;
    return messages || [];
  } catch (err) {
    console.error('[audit-worker] Failed to fetch audit events:', (err as Error).message);
    return [];
  }
}

async function deleteProcessed(sql: ReturnType<typeof postgres>, msgId: number): Promise<void> {
  try {
    await sql`SELECT pgmq.delete('forge_audit_log', ${msgId})`;
  } catch (err) {
    console.error(`[audit-worker] Failed to delete message ${msgId}:`, (err as Error).message);
  }
}

// ============================================================
// Main Consumption Loop
// ============================================================

export async function startAuditLoop(): Promise<void> {
  console.log('[audit-worker] Starting audit event consumer...');
  console.log(`[audit-worker] Poll interval: ${POLL_INTERVAL_MS}ms, batch size: ${BATCH_SIZE}`);

  await ensureAuditQueue();

  while (true) {
    try {
      const sql = getSql();
      try {
        const messages = await fetchAuditEvents(sql);

        if (messages.length > 0) {
          console.log(`[audit-worker] Processing ${messages.length} audit events`);
        }

        for (const msg of messages) {
          const success = await processAuditEvent(sql, msg.message);
          if (success) {
            await deleteProcessed(sql, msg.msg_id);
          }
        }
      } finally {
        await sql.end();
      }
    } catch (err) {
      console.error('[audit-worker] Loop error:', (err as Error).message);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// ============================================================
// Ensure pgmq Queue Exists
// ============================================================

async function ensureAuditQueue(): Promise<void> {
  const sql = getSql();
  try {
    await sql`
      SELECT pgmq.create('forge_audit_log')
    `;
    console.log('[audit-worker] Ensured pgmq queue: forge_audit_log');
  } catch (err) {
    // Queue already exists, which is fine
    console.log('[audit-worker] pgmq queue forge_audit_log already exists');
  } finally {
    await sql.end();
  }
}
