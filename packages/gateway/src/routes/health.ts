// Gateway — Health Route
import type { FastifyInstance } from 'fastify';
import { fetchJWKS } from '../auth.js';

export async function registerHealthRoute(app: FastifyInstance): Promise<void> {
  app.get('/v1/health', async (_request, reply) => {
    const checks: Record<string, string> = {};

    // Check JWKS endpoint
    try {
      await fetchJWKS();
      checks.jwks = 'ok';
    } catch {
      checks.jwks = 'error';
    }

    // Check Postgres connection
    try {
      const { default: postgres } = await import('postgres');
      const sql = postgres(process.env.POSTGRES_URL || '');
      await sql`SELECT 1`;
      await sql.end();
      checks.postgres = 'ok';
    } catch {
      checks.postgres = 'error';
    }

    const allOk = Object.values(checks).every((s) => s === 'ok');

    return reply.status(allOk ? 200 : 503).send({
      success: allOk,
      status: allOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    });
  });
}
