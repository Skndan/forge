// Gateway — Enhanced Health Route
import type { FastifyInstance } from 'fastify';
import { fetchJWKS } from '../auth.js';

interface HealthCheck {
  name: string;
  status: 'ok' | 'error';
  latency?: number;
  error?: string;
}

interface HealthResponse {
  success: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  uptime: number;
  service: string;
  checks: HealthCheck[];
}

const START_TIME = Date.now();

export async function registerHealthRoute(app: FastifyInstance): Promise<void> {
  app.get('/v1/health', async (_request, reply) => {
    const checks: HealthCheck[] = [];

    // Check JWKS endpoint
    const jwksStart = Date.now();
    try {
      await fetchJWKS();
      checks.push({
        name: 'jwks',
        status: 'ok',
        latency: Date.now() - jwksStart,
      });
    } catch (err) {
      checks.push({
        name: 'jwks',
        status: 'error',
        latency: Date.now() - jwksStart,
        error: (err as Error).message,
      });
    }

    // Check Postgres connection
    const pgStart = Date.now();
    try {
      const { default: postgres } = await import('postgres');
      const sql = postgres(process.env.POSTGRES_URL || '');
      await sql`SELECT 1 AS health_check`;
      await sql.end();
      checks.push({
        name: 'postgres',
        status: 'ok',
        latency: Date.now() - pgStart,
      });
    } catch (err) {
      checks.push({
        name: 'postgres',
        status: 'error',
        latency: Date.now() - pgStart,
        error: (err as Error).message,
      });
    }

    // Check RustFS connectivity (optional)
    const storageUrl = process.env.RUSTFS_URL || 'http://rustfs:9000';
    const storageStart = Date.now();
    try {
      const resp = await fetch(`${storageUrl}/minio/health/live`, {
        signal: AbortSignal.timeout(5000),
      });
      checks.push({
        name: 'storage',
        status: resp.ok ? 'ok' : 'error',
        latency: Date.now() - storageStart,
        error: resp.ok ? undefined : `HTTP ${resp.status}`,
      });
    } catch {
      checks.push({
        name: 'storage',
        status: 'error',
        latency: Date.now() - storageStart,
        error: 'Unreachable',
      });
    }

    // Check Valkey connectivity (optional)
    const valkeyUrl = process.env.VALKEY_URL || 'redis://valkey:6379';
    const valkeyStart = Date.now();
    try {
      if (valkeyUrl.startsWith('redis://')) {
        const valkeyHost = valkeyUrl.split('://')[1].split(':')[0];
        const valkeyPort = parseInt(valkeyUrl.split(':')[2] || '6379', 10);
        const conn = await fetch(`http://${valkeyHost}:${valkeyPort}`, {
          signal: AbortSignal.timeout(3000),
        }).catch(() => null);
        checks.push({
          name: 'valkey',
          status: conn !== null ? 'ok' : 'error',
          latency: Date.now() - valkeyStart,
          error: conn === null ? 'Unreachable' : undefined,
        });
      } else {
        checks.push({ name: 'valkey', status: 'ok', latency: 0 });
      }
    } catch {
      checks.push({
        name: 'valkey',
        status: 'error',
        latency: Date.now() - valkeyStart,
        error: 'Unreachable',
      });
    }

    const allOk = checks.every((c) => c.status === 'ok');
    const anyCritical = checks.some((c) => c.name === 'jwks' || c.name === 'postgres')
      && checks.filter((c) => c.name === 'jwks' || c.name === 'postgres').some((c) => c.status === 'error');

    const overallStatus = allOk ? 'healthy' : anyCritical ? 'unhealthy' : 'degraded';
    const httpStatus = allOk ? 200 : anyCritical ? 503 : 200;

    const response: HealthResponse = {
      success: allOk,
      status: overallStatus,
      version: '0.5.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
      service: process.env.SERVICE_NAME || 'forge-gateway',
      checks,
    };

    return reply.status(httpStatus).send(response);
  });
}
