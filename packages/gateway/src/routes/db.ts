// Gateway — DB Query Route
// POST /v1/db/query
import type { FastifyInstance } from 'fastify';
import { jwtVerifyMiddleware, sessionVarsMiddleware } from '../middleware/auth.js';
import { ForgeError } from '../errors.js';
import type { DbQueryRequest } from '@forge/types';

export async function registerDbQueryRoute(app: FastifyInstance): Promise<void> {
  app.post(
    '/v1/db/query',
    {
      preHandler: [jwtVerifyMiddleware, sessionVarsMiddleware],
    },
    async (request, reply) => {
      const { query: sqlQuery, params } = request.body as DbQueryRequest;

      if (!sqlQuery || typeof sqlQuery !== 'string') {
        throw new ForgeError(400, 'VALIDATION_ERROR', 'Query string is required');
      }

      // Security: only allow SELECT queries from the API
      const trimmedQuery = sqlQuery.trim().toUpperCase();
      if (!trimmedQuery.startsWith('SELECT')) {
        throw new ForgeError(403, 'FORBIDDEN', 'Only SELECT queries are allowed');
      }

      try {
        const { default: postgres } = await import('postgres');
        const sql = postgres(process.env.POSTGRES_URL || '', {
          types: {
            // Ensure JSONB returns as parsed objects
          },
        });

        const result = params
          ? await sql.unsafe(sqlQuery, params as unknown[])
          : await sql.unsafe(sqlQuery);

        await sql.end();

        return reply.send({
          success: true,
          data: result,
          row_count: result.length,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Query execution failed';
        throw new ForgeError(400, 'QUERY_ERROR', message);
      }
    },
  );
}
