// Webhook Worker — pgmq Delivery Loop
// Fetches pending deliveries from pgmq and sends webhook HTTP requests

import postgres from 'postgres';
import crypto from 'crypto';

// ============================================================
// Types
// ============================================================

export interface WebhookDelivery {
  id: string;
  subscription_id: string;
  event: string;
  payload: unknown;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  next_retry_at?: Date;
  created_at: Date;
}

export interface WebhookSubscription {
  id: string;
  tenant_id: string;
  url: string;
  secret: string;
  retry_count: number;
}

interface PgmqMessage {
  msg_id: number;
  message: {
    delivery_id: string;
    subscription_id: string;
    event: string;
    payload: unknown;
    tenant_id: string;
  };
}

// ============================================================
// Configuration
// ============================================================

const MAX_RETRIES = 3;
const POLL_INTERVAL_MS = parseInt(process.env.WEBHOOK_POLL_INTERVAL || '5000', 10);
const REQUEST_TIMEOUT_MS = parseInt(process.env.WEBHOOK_TIMEOUT || '10000', 10);

const RETRY_DELAYS = [10_000, 30_000, 120_000]; // 10s, 30s, 2min

function getSql(): ReturnType<typeof postgres> {
  return postgres(process.env.POSTGRES_URL || 'postgres://forge:forge_dev_password_change_me@localhost:5432/forge', {
    max: 5,
    connection: {
      application_name: 'forge-worker-webhook',
    },
  });
}

// ============================================================
// HMAC-SHA256 Signing
// ============================================================

export function signPayload(payload: unknown, secret: string): string {
  const body = JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

export function buildHeaders(secret: string, payload: unknown, subscriptionId: string): Record<string, string> {
  const signature = signPayload(payload, secret);

  return {
    'Content-Type': 'application/json',
    'X-Forge-Signature-256': signature,
    'X-Forge-Subscription-Id': subscriptionId,
    'X-Forge-Event': typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>)['event'] as string || '' : '',
    'User-Agent': 'Forge-Webhook/1.0',
  };
}

// ============================================================
// Exponential Backoff
// ============================================================

export function getBackoffDelay(attempt: number): number {
  if (attempt < RETRY_DELAYS.length) {
    return RETRY_DELAYS[attempt];
  }
  // Exponential backoff: ~4min, ~8min, ~16min...
  return Math.min(RETRY_DELAYS[RETRY_DELAYS.length - 1] * Math.pow(2, attempt - RETRY_DELAYS.length + 1), 3600_000);
}

export function calculateNextRetry(attempt: number): Date {
  const delay = getBackoffDelay(attempt);
  return new Date(Date.now() + delay);
}

// ============================================================
// pgmq Delivery Fetch (SELECT FOR UPDATE SKIP LOCKED)
// ============================================================

async function fetchPendingDeliveries(sql: ReturnType<typeof postgres>): Promise<PgmqMessage[]> {
  try {
    const messages = await sql<PgmqMessage[]>`
      SELECT * FROM pgmq.read('forge_webhook_delivery', 10, 30)
    `;
    return messages || [];
  } catch (err) {
    console.error('[webhook-worker] Failed to fetch deliveries:', (err as Error).message);
    return [];
  }
}

async function deleteProcessedMessage(sql: ReturnType<typeof postgres>, msgId: number): Promise<void> {
  try {
    await sql`SELECT pgmq.delete('forge_webhook_delivery', ${msgId})`;
  } catch (err) {
    console.error(`[webhook-worker] Failed to delete message ${msgId}:`, (err as Error).message);
  }
}

// ============================================================
// Webhook HTTP Delivery
// ============================================================

export async function sendWebhook(
  url: string,
  payload: unknown,
  headers: Record<string, string>,
): Promise<{ success: boolean; statusCode: number }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return {
      success: response.ok,
      statusCode: response.status,
    };
  } catch (err) {
    const message = (err as Error).message;
    const statusCode = message.includes('abort') || message.includes('timeout') ? 408 : 0;
    return { success: false, statusCode };
  }
}

// ============================================================
// Update Delivery Status in Postgres
// ============================================================

async function updateDeliveryStatus(
  sql: ReturnType<typeof postgres>,
  deliveryId: string,
  status: 'delivered' | 'failed',
  attempts: number,
  lastStatusCode: number,
  nextRetryAt: Date | null,
): Promise<void> {
  try {
    await sql`
      UPDATE forge.webhook_deliveries
      SET
        status = ${status},
        attempts = ${attempts},
        last_status_code = ${lastStatusCode},
        next_retry_at = ${nextRetryAt},
        updated_at = now()
      WHERE id = ${deliveryId}::uuid
    `;
  } catch (err) {
    console.error(`[webhook-worker] Failed to update delivery ${deliveryId}:`, (err as Error).message);
  }
}

// ============================================================
// Delivery Loop
// ============================================================

export async function processDelivery(
  sql: ReturnType<typeof postgres>,
  deliveryId: string,
  subscriptionId: string,
  event: string,
  payload: unknown,
  tenantId: string,
): Promise<void> {
  // Get subscription details
  const [subscription] = await sql<WebhookSubscription[]>`
    SELECT id, tenant_id, url, secret, retry_count
    FROM forge.webhook_subscriptions
    WHERE id = ${subscriptionId}::uuid AND is_active = true
  `;

  if (!subscription) {
    console.warn(`[webhook-worker] Subscription ${subscriptionId} not found or inactive, skipping delivery ${deliveryId}`);
    return;
  }

  // Check tenant match
  if (subscription.tenant_id !== tenantId) {
    console.warn(`[webhook-worker] Tenant mismatch for delivery ${deliveryId}`);
    return;
  }

  // Get current delivery attempt count
  const [delivery] = await sql<WebhookDelivery[]>`
    SELECT id, attempts
    FROM forge.webhook_deliveries
    WHERE id = ${deliveryId}::uuid
  `;

  if (!delivery) {
    console.warn(`[webhook-worker] Delivery ${deliveryId} not found`);
    return;
  }

  const attempt = delivery.attempts + 1;
  const maxRetries = Math.min(subscription.retry_count, MAX_RETRIES);

  // Build signed request
  const headers = buildHeaders(subscription.secret, { id: deliveryId, event, ...(payload as object) }, subscriptionId);

  // Send webhook
  const result = await sendWebhook(subscription.url, { id: deliveryId, event, payload }, headers);

  if (result.success) {
    await updateDeliveryStatus(sql, deliveryId, 'delivered', attempt, result.statusCode, null);
    console.log(`[webhook-worker] Delivered ${deliveryId} to ${subscription.url} (attempt ${attempt})`);
  } else {
    const shouldRetry = attempt < maxRetries;
    const nextRetry = shouldRetry ? calculateNextRetry(attempt) : null;

    await updateDeliveryStatus(sql, deliveryId, shouldRetry ? 'pending' : 'failed', attempt, result.statusCode, nextRetry);

    if (shouldRetry) {
      console.log(`[webhook-worker] Failed ${deliveryId}, retrying in ${getBackoffDelay(attempt)}ms (attempt ${attempt}/${maxRetries})`);
    } else {
      console.log(`[webhook-worker] Failed ${deliveryId}, max retries reached (${attempt}/${maxRetries})`);
    }
  }
}

// ============================================================
// Main Polling Loop
// ============================================================

export async function startDeliveryLoop(): Promise<void> {
  console.log('[webhook-worker] Starting delivery loop...');
  console.log(`[webhook-worker] Poll interval: ${POLL_INTERVAL_MS}ms`);

  while (true) {
    try {
      const sql = getSql();
      try {
        const messages = await fetchPendingDeliveries(sql);

        for (const msg of messages) {
          const { delivery_id, subscription_id, event, payload, tenant_id } = msg.message;

          await processDelivery(sql, delivery_id, subscription_id, event, payload, tenant_id);

          // Delete the processed message from pgmq
          await deleteProcessedMessage(sql, msg.msg_id);
        }
      } finally {
        await sql.end();
      }
    } catch (err) {
      console.error('[webhook-worker] Loop error:', (err as Error).message);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
