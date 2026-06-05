// ============================================================
// Forge Realtime Service — WebSocket Server
// ============================================================
//
// Features:
//  - WebSocket server with JWT auth on connect
//  - Postgres LISTEN on pg_notify channels
//  - Valkey pub/sub for multi-instance fan-out
//  - Subscription management (table, filter, row_id)
//  - Reconnection handling
//  - Channel filtering
//
// ============================================================

import {
  handleOpen,
  handleMessage,
  handleClose,
  handleDrain,
  authenticateConnection,
  onValkeyMessage,
  getActiveConnectionCount,
} from './connection.js';
import { extractTokenFromUrl, extractTokenFromProtocol } from './auth.js';
import { valkeyPubSub } from './pubsub.js';
import { pgListenManager } from './pglisten.js';
import { getActiveConnectionCount as getSubCount, getActiveSubscriptionsCount } from './subscriptions.js';

// ============================================================
// Configuration
// ============================================================

const PORT = parseInt(process.env.PORT || '3001', 10);
const POSTGRES_URL = process.env.POSTGRES_URL || 'postgres://forge:forge_dev_password_change_me@localhost:5432/forge';
const VALKEY_URL = process.env.VALKEY_URL || 'redis://localhost:6379';

// ============================================================
// Valkey Pub/Sub Channels
// ============================================================

const VALKEY_CHANNELS_PG = ['forge:realtime:storage', 'forge:realtime:functions', 'forge:realtime:webhooks'];
const VALKEY_CHANNEL_RAW = 'forge:realtime:raw';

// ============================================================
// Bootstrap
// ============================================================

async function bootstrap(): Promise<void> {
  console.log('🚀 Forge Realtime Service starting...');
  console.log(`   Port: ${PORT}`);

  // 1. Connect Valkey pub/sub
  console.log('[realtime] Connecting to Valkey...');
  await valkeyPubSub.connect(VALKEY_URL);

  // Subscribe to all relevant channels
  for (const channel of [...VALKEY_CHANNELS_PG, VALKEY_CHANNEL_RAW]) {
    await valkeyPubSub.subscribe(channel, onValkeyMessage);
  }
  console.log('[realtime] Valkey pub/sub connected and subscribed');

  // 2. Connect to Postgres for LISTEN
  console.log('[realtime] Connecting to Postgres...');
  await pgListenManager.connect(POSTGRES_URL);
  await pgListenManager.startListening();
  console.log('[realtime] Postgres LISTEN started');

  // 3. Start WebSocket server
  const server = Bun.serve({
    port: PORT,
    hostname: '0.0.0.0',
    fetch(req, server) {
      // HTTP health check
      if (req.method === 'GET' && new URL(req.url).pathname === '/health') {
        return healthHandler();
      }

      // WebSocket upgrade
      if (server.upgrade(req)) {
        return;
      }

      return new Response('Not found', { status: 404 });
    },
    websocket: {
      open: async (ws) => {
        await handleOpen(ws);
      },
      message: async (ws, message) => {
        await handleMessage(ws, message);
      },
      close: async (ws) => {
        await handleClose(ws);
      },
      drain: (ws) => {
        handleDrain(ws);
      },
    },
  });

  console.log(`✅ Realtime WebSocket server listening on port ${PORT}`);
}

// ============================================================
// Health Check
// ============================================================

function healthHandler(): Response {
  const checks = {
    valkey: valkeyPubSub.isConnected() ? 'ok' : 'error',
    postgres: pgListenManager.isListening() ? 'ok' : 'error',
  };
  const allOk = Object.values(checks).every((s) => s === 'ok');

  const body = JSON.stringify({
    success: true,
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
    metrics: {
      connections: getActiveConnectionCount(),
      subscriptions: getActiveSubscriptionsCount(),
    },
  });

  return new Response(body, {
    status: allOk ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// Authentication Endpoint (for initial JWT auth over HTTP)
// ============================================================

// Clients authenticate by sending a token parameter in the WebSocket URL:
//   ws://host:port/ws?token=<jwt>
// The server validates the JWT and sets the connection as authenticated.
// Alternatively, a token_<jwt> subprotocol can be used.

// ============================================================
// Start
// ============================================================

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[realtime] SIGTERM received, shutting down...');
  await pgListenManager.disconnect();
  await valkeyPubSub.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[realtime] SIGINT received, shutting down...');
  await pgListenManager.disconnect();
  await valkeyPubSub.disconnect();
  process.exit(0);
});

bootstrap().catch((err) => {
  console.error('[realtime] Failed to start:', err);
  process.exit(1);
});
