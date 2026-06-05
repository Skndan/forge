// Gateway — Main Server Entry Point
// Bun + Fastify
import Fastify from 'fastify';
import { errorHandler } from './errors.js';
import { registerMiddlewares } from './middleware/auth.js';
import { registerHealthRoute } from './routes/health.js';
import { registerDbQueryRoute } from './routes/db.js';
import { registerStorageRoutes } from './routes/storage.js';
import { registerFunctionsRoutes } from './routes/functions.js';
import { registerWebhookRoutes } from './routes/webhooks.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerAdminRoutes } from './routes/admin/index.js';
import { registerMetricsRoute, metrics } from './metrics.js';
import { logger, generateCorrelationId, setCorrelationId } from './logger.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const CORS_ORIGINS = process.env.CORS_ORIGINS || '*';
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
const SERVICE_NAME = process.env.SERVICE_NAME || 'forge-gateway';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // ── Correlation ID ──────────────────────────────────────
  app.addHook('onRequest', async (request) => {
    const corrId = (request.headers['x-correlation-id'] as string) || generateCorrelationId();
    setCorrelationId(corrId);
    request.headers['x-correlation-id'] = corrId;
    logger.info(`→ ${request.method} ${request.url}`, {
      method: request.method,
      path: request.url,
      correlationId: corrId,
      ip: request.ip,
    });
  });

  // ── Metrics Hook ─────────────────────────────────────────
  app.addHook('onResponse', async (request, reply) => {
    const statusGroup = `${Math.floor(reply.statusCode / 100)}xx`;
    metrics.inc('http_requests_total', 1, { method: request.method, path: request.url.split('?')[0] });
    metrics.inc('http_requests_total', 1, { status: statusGroup });
    metrics.set('active_connections', app.printRoutes ? 1 : 1); // placeholder for real count
  });

  // ── CORS ───────────────────────────────────────────────────
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin || CORS_ORIGINS === '*') {
      reply.header('Access-Control-Allow-Origin', origin || '*');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      reply.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Admin-Token, X-Tenant-Id, X-Correlation-Id',
      );
      reply.header('Access-Control-Allow-Credentials', 'true');
      reply.header('Access-Control-Max-Age', '86400');

      if (request.method === 'OPTIONS') {
        reply.code(204);
        return reply.send('');
      }
    }
  });

  // ── Rate Limiting ──────────────────────────────────────────
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

  app.addHook('onRequest', async (request, reply) => {
    if (request.url === '/v1/health' || request.url === '/metrics') return;

    const ip = request.ip;
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
      return;
    }

    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
      logger.warn('Rate limit exceeded', { ip, count: entry.count, correlationId: getCorrelationId() });
      reply.header('Retry-After', '60');
      reply.code(429);
      return reply.send({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
        },
      });
    }
  });

  // ── Error Handler ──────────────────────────────────────────
  app.setErrorHandler(errorHandler);

  // ── Middleware ──────────────────────────────────────────────
  registerMiddlewares(app);

  // ── Routes ─────────────────────────────────────────────────
  await registerHealthRoute(app);
  await registerMetricsRoute(app);
  await registerDbQueryRoute(app);
  await registerStorageRoutes(app);
  await registerFunctionsRoutes(app);
  await registerWebhookRoutes(app);
  await registerAuthRoutes(app);
  await registerAdminRoutes(app);

  return app;
}

function getCorrelationId(): string | null {
  return (globalThis as any).__correlationId || null;
}

// Only start listening when run directly (not imported by tests)
const isMainModule = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('dist/index.js');
if (isMainModule) {
  logger.info(`Starting ${SERVICE_NAME} on port ${PORT}`, { port: PORT, service: SERVICE_NAME });
  const app = await buildApp();
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`🚀 ${SERVICE_NAME} listening on port ${PORT}`);
  } catch (err) {
    logger.error('Failed to start server', { error: (err as Error).message });
    process.exit(1);
  }
}
