// ============================================================
// Forge Worker Scheduler — Cron-based Function Triggers
// ============================================================
//
// Features:
//  - Evaluates cron expressions to trigger functions
//  - Postgres-backed schedule management
//  - Calls function runner via Gateway admin API
//  - Tracks last_run_at and next_run_at
//
// ============================================================

import { startSchedulerLoop } from './scheduler.js';

// ============================================================
// Health Check (HTTP endpoint for Docker healthchecks)
// ============================================================

import http from 'http';

const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || '9101', 10);

function startHealthServer(): void {
  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        status: 'healthy',
        service: 'worker-scheduler',
        timestamp: new Date().toISOString(),
      }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(HEALTH_PORT, '0.0.0.0', () => {
    console.log(`[scheduler-worker] Health server listening on port ${HEALTH_PORT}`);
  });
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  console.log('🚀 Forge Worker Scheduler starting...');
  startHealthServer();
  await startSchedulerLoop();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[scheduler-worker] SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[scheduler-worker] SIGINT received, shutting down...');
  process.exit(0);
});

main().catch((err) => {
  console.error('[scheduler-worker] Fatal error:', err);
  process.exit(1);
});
