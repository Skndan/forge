// Gateway — Auth Middleware
// JWT verification + Postgres session vars + Admin token check
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, extractToken, type VerifiedToken } from '../auth.js';
import { UnauthorizedError, ForbiddenError } from '../errors.js';

// ============================================================
// Types
// ============================================================

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: VerifiedToken;
    isAdminService?: boolean;
  }
}

// ============================================================
// JWT Verification Middleware
// ============================================================

export async function jwtVerifyMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const token = extractToken(request.headers.authorization);

  if (!token) {
    throw new UnauthorizedError('Missing authorization header');
  }

  try {
    const decoded = await verifyToken(token);
    request.currentUser = decoded;
  } catch (err) {
    throw new UnauthorizedError((err as Error).message);
  }
}

// ============================================================
// Admin Token Middleware
// ============================================================

export async function adminTokenMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  // Check admin service token
  const adminToken = request.headers['x-admin-token'] as string | undefined;
  const expectedToken = process.env.ADMIN_SERVICE_TOKEN;

  if (adminToken && expectedToken && adminToken === expectedToken) {
    request.isAdminService = true;
    return;
  }

  // Also allow admin users via JWT
  if (request.currentUser) {
    const roles = request.currentUser.roles || [];
    const clientRoles = request.currentUser.client_roles || [];

    if (roles.includes('admin') || clientRoles.includes('admin')) {
      return;
    }
    throw new ForbiddenError('Admin access required');
  }

  throw new UnauthorizedError('Authentication required');
}

// ============================================================
// Postgres Session Variables Middleware
// ============================================================

export async function sessionVarsMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  if (!request.currentUser) return;

  const { default: postgres } = await import('postgres');
  const sql = postgres(process.env.POSTGRES_URL || '');

  try {
    await sql`
      SELECT forge.set_session_context(
        ${request.currentUser.sub || ''},
        ${JSON.stringify(request.currentUser.roles || [])},
        ${request.currentUser.tenant_id || ''}
      )
    `;
  } finally {
    await sql.end();
  }
}

// ============================================================
// Register Middleware on Fastify Instance
// ============================================================

export function registerMiddlewares(app: FastifyInstance): void {
  // Decorate request
  app.decorateRequest('currentUser', undefined);
  app.decorateRequest('isAdminService', undefined);
}
