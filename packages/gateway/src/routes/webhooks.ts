// Gateway — Webhook Routes
// POST /v1/webhooks (create subscription)
import type { FastifyInstance } from 'fastify';
import { jwtVerifyMiddleware } from '../middleware/auth.js';
import { ForgeError, ValidationError } from '../errors.js';
import type { WebhookCreateRequest } from '@forge/types';

export async function registerWebhookRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/webhooks — create a webhook subscription
  app.post(
    '/v1/webhooks',
    { preHandler: [jwtVerifyMiddleware] },
    async (request, reply) => {
      const { name, url, events } = request.body as WebhookCreateRequest;

      if (!name || !url || !events || !Array.isArray(events) || events.length === 0) {
        throw new ValidationError('name, url, and events (non-empty array) are required');
      }

      // Validate URL
      try {
        new URL(url);
      } catch {
        throw new ValidationError('Invalid webhook URL');
      }

      const { default: postgres } = await import('postgres');
      const sql = postgres(process.env.POSTGRES_URL || '');

      try {
        const [subscription] = await sql`
          INSERT INTO forge.webhook_subscriptions (tenant_id, name, url, events)
          VALUES (
            ${request.currentUser!.tenant_id || ''}::uuid,
            ${name},
            ${url},
            ${events}
          )
          RETURNING id, name, url, events, is_active, created_at
        `;

        return reply.status(201).send({
          success: true,
          data: subscription,
        });
      } catch (err) {
        throw new ForgeError(400, 'QUERY_ERROR', 'Failed to create webhook subscription');
      } finally {
        await sql.end();
      }
    },
  );

  // GET /v1/webhooks — list subscriptions
  app.get(
    '/v1/webhooks',
    { preHandler: [jwtVerifyMiddleware] },
    async (request, reply) => {
      const { default: postgres } = await import('postgres');
      const sql = postgres(process.env.POSTGRES_URL || '');

      try {
        const subscriptions = await sql`
          SELECT id, name, url, events, is_active, retry_count, created_at, updated_at
          FROM forge.webhook_subscriptions
          WHERE tenant_id = ${request.currentUser!.tenant_id || ''}::uuid
          ORDER BY created_at DESC
        `;

        return reply.send({
          success: true,
          data: subscriptions,
        });
      } finally {
        await sql.end();
      }
    },
  );
}
