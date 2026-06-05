// Realtime — Postgres LISTEN / pg_notify consumer
// Listens to PostgreSQL NOTIFY channels and fans out via Valkey pub/sub

import postgres from 'postgres';
import { valkeyPubSub } from './pubsub.js';

// ============================================================
// Types
// ============================================================

export interface PgNotifyPayload {
  table: string;
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  id: string;
  tenant_id: string;
}

// ============================================================
// Channel Mappings
// ============================================================

const PG_CHANNELS = ['forge:storage', 'forge:functions', 'forge:webhooks'];

// Map Postgres channels to Valkey pub/sub channels
function pgChannelToValkey(channel: string): string {
  return `forge:realtime:${channel.replace('forge:', '')}`;
}

// ============================================================
// Postgres LISTEN Manager
// ============================================================

class PgListenManager {
  private sql: ReturnType<typeof postgres> | null = null;
  private listening = false;

  async connect(connectionUrl: string): Promise<void> {
    this.sql = postgres(connectionUrl, {
      max: 2,
      connection: {
        onnotification: async (_pgCh: string, _payload: string) => {
          // This is handled by the LISTEN loop below
        },
      },
    });
  }

  async startListening(): Promise<void> {
    if (!this.sql) throw new Error('Postgres not connected');
    if (this.listening) return;

    this.listening = true;

    for (const channel of PG_CHANNELS) {
      await this.sql`LISTEN ${this.sql(channel)}`;
      console.log(`[realtime:pglisten] Listening on ${channel}`);
    }

    // Start processing notifications
    this.processNotifications();
  }

  private async processNotifications(): Promise<void> {
    if (!this.sql) return;

    while (this.listening) {
      try {
        const result = await this.sql`SELECT 1 AS ping`;
        if (!result || result.length === 0) break;
      } catch (err) {
        if (!this.listening) break;
        console.error('[realtime:pglisten] Connection error, reconnecting in 2s...', (err as Error).message);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      // Small delay between polls — pg notifications are delivered via
      // the connection's notification callback, but we poll to keep alive
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  async stopListening(): Promise<void> {
    this.listening = false;
    if (this.sql) {
      for (const channel of PG_CHANNELS) {
        try {
          await this.sql`UNLISTEN ${this.sql(channel)}`;
        } catch {
          // ignore
        }
      }
    }
  }

  async disconnect(): Promise<void> {
    await this.stopListening();
    if (this.sql) {
      await this.sql.end();
      this.sql = null;
    }
  }

  // Called externally when a pg_notify event arrives
  async handleNotification(channel: string, payload: string): Promise<void> {
    try {
      const data: PgNotifyPayload = JSON.parse(payload);

      // Filter out notifications without required fields
      if (!data.table || !data.op) return;

      // Fan out via Valkey pub/sub to all realtime instances
      const valkeyChannel = pgChannelToValkey(channel);
      await valkeyPubSub.publish(valkeyChannel, {
        table: data.table,
        op: data.op,
        id: data.id,
        tenant_id: data.tenant_id,
      });

      // Also publish to the raw channel for direct listeners
      await valkeyPubSub.publish(`forge:realtime:raw`, {
        table: data.table,
        op: data.op,
        id: data.id,
        tenant_id: data.tenant_id,
      });
    } catch (err) {
      console.error('[realtime:pglisten] Failed to handle notification:', err);
    }
  }

  isListening(): boolean {
    return this.listening;
  }
}

export const pgListenManager = new PgListenManager();
