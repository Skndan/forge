// Forge — Centralized Error Tracking
// Batches errors and sends to configurable endpoint (webhook, logging service)
// Falls back to structured JSON logging

import { logger } from './logger.js';

interface ErrorEvent {
  level: 'error' | 'warning' | 'critical';
  message: string;
  code?: string;
  stack?: string;
  service: string;
  correlationId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const ERROR_QUEUE: ErrorEvent[] = [];
const FLUSH_INTERVAL_MS = 10_000; // flush every 10 seconds
const MAX_QUEUE_SIZE = 100;

let flushTimer: ReturnType<typeof setInterval> | null = null;

function startFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flush();
  }, FLUSH_INTERVAL_MS);

  // Don't prevent process exit
  if (flushTimer && typeof flushTimer === 'object' && 'unref' in flushTimer) {
    (flushTimer as NodeJS.Timeout).unref();
  }
}

function getErrorWebhookUrl(): string | undefined {
  return process.env.ERROR_WEBHOOK_URL;
}

async function flush(): Promise<void> {
  if (ERROR_QUEUE.length === 0) return;

  const batch = ERROR_QUEUE.splice(0, MAX_QUEUE_SIZE);
  const webhookUrl = getErrorWebhookUrl();

  if (webhookUrl) {
    try {
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) {
        logger.warn('Error tracking webhook returned non-OK', {
          status: resp.status,
          count: batch.length,
        });
      }
    } catch (err) {
      // Fallback: log the errors locally if webhook fails
      logger.warn('Failed to send error batch to webhook', {
        error: (err as Error).message,
        count: batch.length,
      });
      for (const event of batch) {
        logger.error(event.message, {
          code: event.code,
          correlationId: event.correlationId,
          metadata: event.metadata,
        });
      }
    }
  } else {
    // No webhook configured — log to stdout
    for (const event of batch) {
      logger.error(event.message, {
        level: event.level,
        code: event.code,
        correlationId: event.correlationId,
        metadata: event.metadata,
        stack: event.stack,
      });
    }
  }
}

export function captureError(
  error: Error | string,
  metadata?: Record<string, unknown>,
  level: ErrorEvent['level'] = 'error',
): void {
  const message = typeof error === 'string' ? error : error.message;
  const stack = typeof error === 'string' ? undefined : error.stack;

  const event: ErrorEvent = {
    level,
    message,
    stack,
    service: process.env.SERVICE_NAME || 'forge',
    timestamp: new Date().toISOString(),
    metadata,
  };

  ERROR_QUEUE.push(event);

  if (ERROR_QUEUE.length >= MAX_QUEUE_SIZE) {
    flush();
  }

  startFlushTimer();
}

export function captureWarning(
  message: string,
  metadata?: Record<string, unknown>,
): void {
  captureError(message, metadata, 'warning');
}

export function captureCritical(
  error: Error | string,
  metadata?: Record<string, unknown>,
): void {
  captureError(error, metadata, 'critical');
}

// For cases where error tracking needs immediate flush (e.g., before exit)
export async function flushErrors(): Promise<void> {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  await flush();
}
