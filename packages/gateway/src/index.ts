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

const PORT = parseInt(process.env.PORT || '3000', 10);
const CORS_ORIGINS = process.env.CORS_ORIGINS || '*';
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // ── CORS ───────────────────────────────────────────────────
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin || CORS_ORIGINS === '*') {
      reply.header('Access-Control-Allow-Origin', origin || '*');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      reply.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Admin-Token, X-Tenant-Id',
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
    if (request.url === '/v1/health') return;

    const ip = request.ip;
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
      return;
    }

    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
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
  await registerDbQueryRoute(app);
  await registerStorageRoutes(app);
  await registerFunctionsRoutes(app);
  await registerWebhookRoutes(app);
  await registerAuthRoutes(app);
  await registerAdminRoutes(app);

  return app;
}

// Only start listening when run directly (not imported by tests)
const isMainModule = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('dist/index.js');
if (isMainModule) {
  const app = await buildApp();
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Gateway listening on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
