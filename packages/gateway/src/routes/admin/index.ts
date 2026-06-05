// Gateway — Admin Routes
// Prefix: /v1/admin, protected by admin token
import type { FastifyInstance } from 'fastify';
import { jwtVerifyMiddleware, adminTokenMiddleware } from '../../middleware/auth.js';

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  // All admin routes require auth + admin check
  app.register(async function adminScope(adminApp: FastifyInstance) {
    adminApp.addHook('preHandler', jwtVerifyMiddleware);
    adminApp.addHook('preHandler', adminTokenMiddleware);

    // GET /v1/admin/tenants — list all tenants
    adminApp.get('/v1/admin/tenants', async (_request, reply) => {
      const { default: postgres } = await import('postgres');
      const sql = postgres(process.env.POSTGRES_URL || '');

      try {
        const tenants = await sql`
          SELECT id, name, slug, plan, created_at, updated_at
          FROM forge.tenants
          ORDER BY created_at DESC
        `;

        return reply.send({ success: true, data: tenants });
      } finally {
        await sql.end();
      }
    });

    // GET /v1/admin/users — list all users
    adminApp.get('/v1/admin/users', async (_request, reply) => {
      const { default: postgres } = await import('postgres');
      const sql = postgres(process.env.POSTGRES_URL || '');

      try {
        const users = await sql`
          SELECT id, tenant_id, email, display_name, is_admin, created_at
          FROM forge.users
          ORDER BY created_at DESC
          LIMIT 100
        `;

        return reply.send({ success: true, data: users });
      } finally {
        await sql.end();
      }
    });

    // GET /v1/admin/health — detailed health check
    adminApp.get('/v1/admin/health', async (_request, reply) => {
      const checks: Record<string, string> = {};

      // Check postgres
      try {
        const { default: postgres } = await import('postgres');
        const sql = postgres(process.env.POSTGRES_URL || '');
        await sql`SELECT 1`;
        await sql.end();
        checks.postgres = 'ok';
      } catch {
        checks.postgres = 'error';
      }

      return reply.send({
        success: true,
        status: Object.values(checks).every((s) => s === 'ok') ? 'healthy' : 'degraded',
        checks,
      });
    });
  });
}
