// Gateway — Functions Route
// POST /v1/functions/invoke
import type { FastifyInstance } from 'fastify';
import { jwtVerifyMiddleware, sessionVarsMiddleware } from '../middleware/auth.js';
import { ForgeError, NotFoundError } from '../errors.js';
import type { FunctionInvokeRequest } from '@forge/types';

export async function registerFunctionsRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/v1/functions/invoke',
    { preHandler: [jwtVerifyMiddleware, sessionVarsMiddleware] },
    async (request, reply) => {
      const { function_id, payload, async: isAsync } = request.body as FunctionInvokeRequest;

      if (!function_id) {
        throw new ForgeError(400, 'VALIDATION_ERROR', 'function_id is required');
      }

      // Look up the function definition
      const { default: postgres } = await import('postgres');
      const sql = postgres(process.env.POSTGRES_URL || '');

      let funcDef;
      try {
        const results = await sql`
          SELECT id, tenant_id, name, slug, runtime, source, entrypoint, env_vars, timeout_ms, is_active
          FROM forge.function_definitions
          WHERE id = ${function_id}::uuid
            AND tenant_id = ${request.currentUser!.tenant_id || ''}::uuid
            AND is_active = true
          LIMIT 1
        `;

        if (results.length === 0) {
          throw new NotFoundError('Function not found or inactive');
        }

        funcDef = results[0];
      } finally {
        await sql.end();
      }

      if (isAsync) {
        // Queue the function invocation for async execution
        // TODO: push to pgmq or valkey queue
        return reply.status(202).send({
          success: true,
          data: {
            function_id,
            status: 'queued',
            async: true,
          },
        });
      }

      // For synchronous functions, proxy to the function runner
      const runnerUrl = process.env.FUNCTION_RUNNER_URL || 'http://function-runner:3002';

      try {
        const response = await fetch(`${runnerUrl}/invoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            function_id,
            payload,
            scoped_user_id: request.currentUser!.sub,
          }),
        });

        const result = await response.json();

        return reply.send({
          success: true,
          data: result,
        });
      } catch (err) {
        throw new ForgeError(502, 'FUNCTION_ERROR', 'Function runner unavailable');
      }
    },
  );
}
