// Realtime — Valkey Pub/Sub Manager
// Handles multi-instance fan-out via Valkey (Redis-compatible)

import Redis from 'ioredis';

// ============================================================
// Types
// ============================================================

export interface PubSubMessage {
  table: string;
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  id: string;
  tenant_id: string;
  payload?: Record<string, unknown>;
}

export type MessageHandler = (channel: string, message: PubSubMessage) => void;

// ============================================================
// Valkey Pub/Sub Client
// ============================================================

class ValkeyPubSub {
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private connected = false;

  async connect(url: string): Promise<void> {
    this.publisher = new Redis(url, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.subscriber = new Redis(url, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.subscriber.on('message', (channel: string, message: string) => {
      try {
        const parsed: PubSubMessage = JSON.parse(message);
        const channelHandlers = this.handlers.get(channel);
        if (channelHandlers) {
          for (const handler of channelHandlers) {
            handler(channel, parsed);
          }
        }
      } catch (err) {
        console.error('[realtime:pubsub] Failed to parse message:', err);
      }
    });

    this.subscriber.on('connect', () => {
      this.connected = true;
      console.log('[realtime:pubsub] Connected to Valkey');
    });

    this.subscriber.on('error', (err) => {
      console.error('[realtime:pubsub] Valkey error:', err.message);
    });

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Valkey connection timeout')), 10000);
      this.subscriber!.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
    }
    if (this.publisher) {
      await this.publisher.quit();
    }
    this.connected = false;
    this.handlers.clear();
  }

  async subscribe(channel: string, handler: MessageHandler): Promise<void> {
    if (!this.subscriber || !this.connected) {
      throw new Error('Pub/sub not connected');
    }

    await this.subscriber.subscribe(channel);

    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel)!.add(handler);
  }

  async unsubscribe(channel: string, handler?: MessageHandler): Promise<void> {
    if (!this.subscriber) return;

    if (handler) {
      const handlers = this.handlers.get(channel);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          await this.subscriber.unsubscribe(channel);
          this.handlers.delete(channel);
        }
      }
    } else {
      await this.subscriber.unsubscribe(channel);
      this.handlers.delete(channel);
    }
  }

  async publish(channel: string, message: PubSubMessage): Promise<void> {
    if (!this.publisher) {
      throw new Error('Publisher not connected');
    }
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const valkeyPubSub = new ValkeyPubSub();
