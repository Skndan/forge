// ============================================================
// Forge Audit Worker — Audit Event Consumer
// ============================================================
//
// Features:
//  - Reads audit events from pgmq queue
//  - Writes to forge.audit_logs table
//  - Batched processing with configurable interval
//  - Validates required fields before inserting
//
// ============================================================

import { startAuditLoop } from './consumer.js';

// ============================================================
// Health Check (HTTP endpoint for Docker healthchecks)
// ============================================================

import http from 'http';

const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || '9102', 10);

function startHealthServer(): void {
  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        status: 'healthy',
        service: 'worker-audit',
        timestamp: new Date().toISOString(),
      }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(HEALTH_PORT, '0.0.0.0', () => {
    console.log(`[audit-worker] Health server listening on port ${HEALTH_PORT}`);
  });
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  console.log('🚀 Forge Audit Worker starting...');
  startHealthServer();
  await startAuditLoop();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[audit-worker] SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[audit-worker] SIGINT received, shutting down...');
  process.exit(0);
});

main().catch((err) => {
  console.error('[audit-worker] Fatal error:', err);
  process.exit(1);
});
