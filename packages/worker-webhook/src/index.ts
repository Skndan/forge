// ============================================================
// Forge Webhook Worker — pgmq Delivery with Retry + HMAC
// ============================================================
//
// Features:
//  - pgmq delivery loop with SELECT FOR UPDATE SKIP LOCKED
//  - Exponential backoff retry
//  - HMAC-SHA256 signing of webhook payloads
//  - Configurable retry count and timeouts
//
// ============================================================

import { startDeliveryLoop } from './delivery.js';

// ============================================================
// Health Check (HTTP endpoint for Docker healthchecks)
// ============================================================

import http from 'http';

const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || '9100', 10);

function startHealthServer(): void {
  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        status: 'healthy',
        service: 'worker-webhook',
        timestamp: new Date().toISOString(),
      }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(HEALTH_PORT, '0.0.0.0', () => {
    console.log(`[webhook-worker] Health server listening on port ${HEALTH_PORT}`);
  });
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  console.log('🚀 Forge Webhook Worker starting...');

  // Start health server
  startHealthServer();

  // Start delivery loop
  await startDeliveryLoop();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[webhook-worker] SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[webhook-worker] SIGINT received, shutting down...');
  process.exit(0);
});

main().catch((err) => {
  console.error('[webhook-worker] Fatal error:', err);
  process.exit(1);
});
