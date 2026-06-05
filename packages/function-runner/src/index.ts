// Function Runner — Main Entry Point
// ============================================================
//
// HTTP server for executing, deploying, and managing serverless functions.
// Uses Bun's built-in HTTP server for performance.
//
// Endpoints:
//   GET    /health              — Health check
//   POST   /v1/functions        — Create function (admin token required)
//   GET    /v1/functions        — List functions (admin token required)
//   GET    /v1/functions/:id    — Get function (admin token required)
//   PUT    /v1/functions/:id    — Update function (admin token required)
//   DELETE /v1/functions/:id    — Delete function (admin token required)
//   POST   /v1/functions/:id/invoke — Invoke function (admin token required)
//   GET    /v1/functions/:id/logs   — Get function logs (admin token required)
//   GET    /v1/invocations/:id      — Get invocation details
//
// Internal routes (from gateway proxy):
//   POST   /invoke              — Quick invoke (used by gateway proxy)

import { config } from './config.js';
import { getDb, cleanExpiredLogs } from './db.js';
import { getLogCollector } from './logs.js';
import { getWarmPool } from './pool.js';
import { resetSandbox } from './sandbox.js';
import { executeFunction } from './executor.js';
import { handleDeploymentRequest } from './deployment.js';

const LOG_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

async function handleHealth(): Promise<Response> {
  const checks: Record<string, string> = {};

  // Check database connectivity
  try {
    const sql = getDb();
    await sql`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  // Check warm pool status
  try {
    const pool = getWarmPool();
    checks.warm_pool = `${pool.size} functions warmed`;
  } catch {
    checks.warm_pool = 'error';
  }

  const allOk = Object.values(checks).every((s) => s === 'ok');
  const status = allOk ? 'healthy' : 'degraded';

  return new Response(
    JSON.stringify({
      success: true,
      status,
      timestamp: new Date().toISOString(),
      checks,
    }),
    {
      status: allOk ? 200 : 503,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

async function handleQuickInvoke(request: Request): Promise<Response> {
  // Used by the Gateway proxy to invoke a function directly
  // Expects: { function_id, payload, scoped_user_id }
  try {
    const body = await request.json() as {
      function_id: string;
      payload: unknown;
      scoped_user_id: string;
    };

    if (!body.function_id || !body.scoped_user_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const result = await executeFunction({
      functionId: body.function_id,
      tenantId: '', // Will be resolved from the function definition
      payload: body.payload,
      invokedBy: body.scoped_user_id,
    });

    if (result.success) {
      return new Response(
        JSON.stringify({
          success: true,
          data: result.data,
          invocation_id: result.invocationId,
          duration_ms: result.durationMs,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(
      JSON.stringify({
        success: false,
        error: result.error,
        invocation_id: result.invocationId,
        duration_ms: result.durationMs,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

// ── Log Cleanup Task ──────────────────────────────────────

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startLogCleanup(): void {
  cleanupInterval = setInterval(async () => {
    try {
      const deleted = await cleanExpiredLogs();
      if (deleted > 0) {
        console.log(`[LogCleanup] Deleted ${deleted} expired log entries`);
      }
    } catch (err) {
      console.error('[LogCleanup] Error:', err);
    }
  }, LOG_CLEANUP_INTERVAL);
}

function stopLogCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// ── Main Request Handler ──────────────────────────────────

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS headers
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Route matching
  let response: Response;

  if (path === '/health' || path === '/v1/health') {
    response = await handleHealth();
  } else if (path === '/invoke' && request.method === 'POST') {
    response = await handleQuickInvoke(request);
  } else {
    response = await handleDeploymentRequest(request);
  }

  // Add CORS headers to all responses
  const combinedHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    combinedHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    headers: combinedHeaders,
  });
}

// ── Server Startup ───────────────────────────────────────

async function main(): Promise<void> {
  console.log(`[FunctionRunner] Starting on port ${config.port}...`);
  console.log(`[FunctionRunner] Sandbox mode: ${process.env.FORGE_SANDBOX_MODE || 'docker'}`);

  // Test database connection
  try {
    const sql = getDb();
    await sql`SELECT 1`;
    console.log('[FunctionRunner] Database connected');
  } catch (err) {
    console.error('[FunctionRunner] Database connection failed:', err);
    process.exit(1);
  }

  // Start warm pool
  const pool = getWarmPool();
  console.log('[FunctionRunner] Warm pool started');

  // Start log collector
  const logCollector = getLogCollector();
  console.log('[FunctionRunner] Log collector started');

  // Start log cleanup task
  startLogCleanup();
  console.log('[FunctionRunner] Log cleanup scheduled (every 24h)');

  // Start server
  Bun.serve({
    port: config.port,
    fetch: handleRequest,
  });

  console.log(`[FunctionRunner] Server listening on :${config.port}`);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[FunctionRunner] SIGTERM received, shutting down...');
    stopLogCleanup();
    await logCollector.flush();
    stopLogCleanup();
    pool.stop();
    resetSandbox();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('[FunctionRunner] SIGINT received, shutting down...');
    stopLogCleanup();
    await logCollector.flush();
    pool.stop();
    resetSandbox();
    process.exit(0);
  });
}

// Health check export for Docker health checks
export { handleHealth };


// Start
main().catch((err) => {
  console.error('[FunctionRunner] Fatal error:', err);
  process.exit(1);
});
