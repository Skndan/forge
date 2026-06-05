// Gateway — Auth Route
// GET /v1/auth/me
import type { FastifyInstance } from 'fastify';
import { jwtVerifyMiddleware } from '../middleware/auth.js';

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/v1/auth/me',
    { preHandler: [jwtVerifyMiddleware] },
    async (request, reply) => {
      const user = request.currentUser!;

      // Fetch user details from postgres if needed
      const { default: postgres } = await import('postgres');
      const sql = postgres(process.env.POSTGRES_URL || '');

      try {
        const users = await sql`
          SELECT id, email, display_name, avatar_url, is_admin, tenant_id, created_at
          FROM forge.users
          WHERE id = ${user.sub}::uuid AND tenant_id = ${user.tenant_id || ''}::uuid
          LIMIT 1
        `;

        const profile = users.length > 0 ? users[0] : null;

        return reply.send({
          success: true,
          data: {
            id: user.sub,
            email: user.email || profile?.email,
            tenant_id: user.tenant_id || profile?.tenant_id,
            plan: user.plan,
            roles: user.roles || [],
            display_name: profile?.display_name || '',
            avatar_url: profile?.avatar_url || null,
            is_admin: profile?.is_admin || false,
          },
        });
      } finally {
        await sql.end();
      }
    },
  );
}
