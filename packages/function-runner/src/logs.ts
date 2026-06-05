// Function Runner — Logs Collection (FR-007)
// ============================================================
//
// Captures stdout/stderr from function execution and persists
// them to the database. Supports both real-time streaming
// (via valkey pub/sub) and batch insertion.

import { insertLogBatch } from './db.js';
import { config } from './config.js';

export interface LogEntry {
  function_id: string;
  tenant_id: string;
  invocation_id: string;
  log_type: 'stdout' | 'stderr';
  message: string;
  timestamp: number;
}

/**
 * In-memory log buffer that batches log entries and flushes
 * to the database periodically or on explicit flush.
 */
export class LogCollector {
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly flushIntervalMs: number;
  private readonly maxBufferSize: number;

  constructor(flushIntervalMs = 1000, maxBufferSize = 100) {
    this.flushIntervalMs = flushIntervalMs;
    this.maxBufferSize = maxBufferSize;
  }

  start(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error('[LogCollector] Flush error:', err);
      });
    }, this.flushIntervalMs);
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  add(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush().catch((err) => {
        console.error('[LogCollector] Flush error:', err);
      });
    }
  }

  addStdout(
    functionId: string,
    tenantId: string,
    invocationId: string,
    message: string,
  ): void {
    this.add({
      function_id: functionId,
      tenant_id: tenantId,
      invocation_id: invocationId,
      log_type: 'stdout',
      message,
      timestamp: Date.now(),
    });
  }

  addStderr(
    functionId: string,
    tenantId: string,
    invocationId: string,
    message: string,
  ): void {
    this.add({
      function_id: functionId,
      tenant_id: tenantId,
      invocation_id: invocationId,
      log_type: 'stderr',
      message,
      timestamp: Date.now(),
    });
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0);
    try {
      const dbEntries = batch.map((e) => ({
        function_id: e.function_id,
        tenant_id: e.tenant_id,
        invocation_id: e.invocation_id,
        log_type: e.log_type as 'stdout' | 'stderr',
        message: e.message,
      }));
      await insertLogBatch(dbEntries);
    } catch (err) {
      // Re-add failed entries to the buffer
      this.buffer.unshift(...batch);
      throw err;
    }
  }

  get bufferSize(): number {
    return this.buffer.length;
  }
}

/**
 * Parse stdout lines into log entries.
 * Handles ANSI escape sequences and trailing newlines.
 */
export function parseLogOutput(
  output: string,
): string[] {
  // Remove ANSI escape sequences
  const clean = output.replace(/\x1b\[[0-9;]*m/g, '');
  // Split by newlines, filter empty
  return clean.split('\n').filter((line) => line.length > 0);
}

/**
 * Truncate a log message to the maximum allowed length.
 */
export function truncateLogMessage(
  message: string,
  maxLength = 65536,
): string {
  if (message.length <= maxLength) return message;
  return message.slice(0, maxLength) + '... [truncated]';
}

/**
 * Create a new LogCollector singleton.
 */
let _collector: LogCollector | null = null;

export function getLogCollector(): LogCollector {
  if (!_collector) {
    _collector = new LogCollector();
    _collector.start();
  }
  return _collector;
}

export function stopLogCollector(): void {
  if (_collector) {
    _collector.stop();
    _collector = null;
  }
}
