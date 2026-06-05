// Function Runner — Function Deployment API (FR-006)
// ============================================================
//
// HTTP API for deploying, updating, and deleting serverless functions.
// This is consumed by the Gateway service and exposes:
//
//   POST   /v1/functions           — Create a new function
//   GET    /v1/functions           — List functions
//   GET    /v1/functions/:id       — Get function details
//   PUT    /v1/functions/:id       — Update function
//   DELETE /v1/functions/:id       — Delete function
//   POST   /v1/functions/:id/invoke — Invoke a function (sync or async)
//   GET    /v1/functions/:id/logs  — Get function logs
//   GET    /v1/invocations/:id     — Get invocation details


import {
  getFunctionById,
  listFunctions,
  createFunction,
  updateFunction,
  deleteFunction,
  getLogsByFunction,
  getInvocation,
} from './db.js';
import { executeFunction, validateFunctionCode } from './executor.js';
import { getWarmPool } from './pool.js';

// ── Request/Response Types ──────────────────────────────────

interface CreateFunctionBody {
  tenant_id: string;
  name: string;
  slug: string;
  source: string;
  entrypoint?: string;
  env_vars?: Record<string, string>;
  timeout_ms?: number;
}

interface UpdateFunctionBody {
  tenant_id: string;
  name?: string;
  slug?: string;
  source?: string;
  entrypoint?: string;
  env_vars?: Record<string, string>;
  timeout_ms?: number;
  is_active?: boolean;
}

interface InvokeFunctionBody {
  tenant_id: string;
  payload: unknown;
  invoked_by: string;
  async?: boolean;
  allowed_tables?: string[];
  allowed_buckets?: string[];
}

// ── JSON Helpers ────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(code: string, message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ success: false, error: { code, message } }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

function parseBody<T>(request: Request): T | null {
  try {
    return JSON.parse(request.body as unknown as string) as T;
  } catch {
    return null;
  }
}

// ── Auth Check ──────────────────────────────────────────────

function checkAdminAuth(request: Request): boolean {
  const auth = request.headers.get('authorization');
  const token = auth?.replace('Bearer ', '');
  const adminToken = process.env.ADMIN_SERVICE_TOKEN || '';
  return token === adminToken;
}

function checkTenantMatch(tenantId: string, request: Request): boolean {
  const requestTenantId = request.headers.get('x-tenant-id');
  return !requestTenantId || requestTenantId === tenantId;
}

// ── Route Handlers ──────────────────────────────────────────

async function handleCreateFunction(request: Request): Promise<Response> {
  if (!checkAdminAuth(request)) {
    return errorResponse('UNAUTHORIZED', 'Invalid admin token', 401);
  }

  const body = parseBody<CreateFunctionBody>(request);
  if (!body) {
    return errorResponse('VALIDATION_ERROR', 'Invalid request body');
  }

  if (!body.tenant_id || !body.name || !body.slug || !body.source) {
    return errorResponse('VALIDATION_ERROR', 'Missing required fields: tenant_id, name, slug, source');
  }

  // Validate source code
  const validation = await validateFunctionCode(body.source, body.entrypoint || 'index.ts', body.env_vars || {});
  if (!validation.valid) {
    return errorResponse('VALIDATION_ERROR', validation.errors.join('; '));
  }

  try {
    const func = await createFunction(
      body.tenant_id,
      body.name,
      body.slug,
      body.source,
      body.entrypoint || 'index.ts',
      body.env_vars || {},
      body.timeout_ms || 30000,
    );

    return jsonResponse(func, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create function';
    if (message.includes('duplicate') || message.includes('unique')) {
      return errorResponse('CONFLICT', `Function with slug '${body.slug}' already exists`, 409);
    }
    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}

async function handleListFunctions(request: Request): Promise<Response> {
  if (!checkAdminAuth(request)) {
    return errorResponse('UNAUTHORIZED', 'Invalid admin token', 401);
  }

  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenant_id');
  if (!tenantId) {
    return errorResponse('VALIDATION_ERROR', 'tenant_id query parameter is required');
  }

  try {
    const functions = await listFunctions(tenantId);
    return jsonResponse(functions);
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', 'Failed to list functions', 500);
  }
}

async function handleGetFunction(request: Request, functionId: string): Promise<Response> {
  if (!checkAdminAuth(request)) {
    return errorResponse('UNAUTHORIZED', 'Invalid admin token', 401);
  }

  try {
    const func = await getFunctionById(functionId);
    if (!func) {
      return errorResponse('NOT_FOUND', 'Function not found', 404);
    }

    const url = new URL(request.url);
    const tenantId = url.searchParams.get('tenant_id') || request.headers.get('x-tenant-id');
    if (tenantId && func.tenant_id !== tenantId) {
      return errorResponse('FORBIDDEN', 'Function does not belong to this tenant', 403);
    }

    return jsonResponse(func);
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', 'Failed to get function', 500);
  }
}

async function handleUpdateFunction(request: Request, functionId: string): Promise<Response> {
  if (!checkAdminAuth(request)) {
    return errorResponse('UNAUTHORIZED', 'Invalid admin token', 401);
  }

  const body = parseBody<UpdateFunctionBody>(request);
  if (!body) {
    return errorResponse('VALIDATION_ERROR', 'Invalid request body');
  }

  if (!body.tenant_id) {
    return errorResponse('VALIDATION_ERROR', 'tenant_id is required');
  }

  if (!checkTenantMatch(body.tenant_id, request)) {
    return errorResponse('FORBIDDEN', 'Tenant mismatch', 403);
  }

  try {
    const func = await updateFunction(functionId, body.tenant_id, {
      name: body.name,
      slug: body.slug,
      source: body.source,
      entrypoint: body.entrypoint,
      env_vars: body.env_vars,
      timeout_ms: body.timeout_ms,
      is_active: body.is_active,
    });

    if (!func) {
      return errorResponse('NOT_FOUND', 'Function not found', 404);
    }

    return jsonResponse(func);
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', 'Failed to update function', 500);
  }
}

async function handleDeleteFunctionRoute(request: Request, functionId: string): Promise<Response> {
  if (!checkAdminAuth(request)) {
    return errorResponse('UNAUTHORIZED', 'Invalid admin token', 401);
  }

  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenant_id');
  if (!tenantId) {
    return errorResponse('VALIDATION_ERROR', 'tenant_id query parameter is required');
  }

  try {
    const deleted = await deleteFunction(functionId, tenantId);
    if (!deleted) {
      return errorResponse('NOT_FOUND', 'Function not found', 404);
    }

    // Evict from warm pool if present
    const pool = getWarmPool();
    if (pool.isWarm(functionId)) {
      await pool.evict(functionId);
    }

    return jsonResponse({ deleted: true });
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', 'Failed to delete function', 500);
  }
}

async function handleInvokeFunction(
  request: Request,
  functionId: string,
): Promise<Response> {
  if (!checkAdminAuth(request)) {
    return errorResponse('UNAUTHORIZED', 'Invalid admin token', 401);
  }

  const body = parseBody<InvokeFunctionBody>(request);
  if (!body) {
    return errorResponse('VALIDATION_ERROR', 'Invalid request body');
  }

  if (!body.tenant_id || !body.invoked_by) {
    return errorResponse('VALIDATION_ERROR', 'Missing required fields: tenant_id, invoked_by');
  }

  if (body.async) {
    // Async invocation: return immediately with queued status
    return jsonResponse({
      function_id: functionId,
      status: 'queued',
      async: true,
    }, 202);
  }

  try {
    // Record usage for warm pool tracking
    const pool = getWarmPool();
    pool.recordUsage(functionId);

    const result = await executeFunction({
      functionId,
      tenantId: body.tenant_id,
      payload: body.payload,
      invokedBy: body.invoked_by,
      allowedTables: body.allowed_tables,
      allowedBuckets: body.allowed_buckets,
    });

    if (result.success) {
      return jsonResponse({
        invocation_id: result.invocationId,
        data: result.data,
        duration_ms: result.durationMs,
      });
    }
    return errorResponse(
      result.error?.code || 'EXECUTION_ERROR',
      result.error?.message || 'Function execution failed',
      400,
    );
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', 'Function execution failed', 500);
  }
}

async function handleGetLogs(request: Request, functionId: string): Promise<Response> {
  if (!checkAdminAuth(request)) {
    return errorResponse('UNAUTHORIZED', 'Invalid admin token', 401);
  }

  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenant_id');
  const limit = parseInt(url.searchParams.get('limit') || '100', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  if (!tenantId) {
    return errorResponse('VALIDATION_ERROR', 'tenant_id query parameter is required');
  }

  try {
    const result = await getLogsByFunction(functionId, tenantId, limit, offset);
    return jsonResponse(result);
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', 'Failed to get logs', 500);
  }
}

async function handleGetInvocation(
  _request: Request,
  invocationId: string,
): Promise<Response> {
  try {
    const invocation = await getInvocation(invocationId);
    if (!invocation) {
      return errorResponse('NOT_FOUND', 'Invocation not found', 404);
    }
    return jsonResponse(invocation);
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', 'Failed to get invocation', 500);
  }
}

// ── Main Request Router ────────────────────────────────────

export async function handleDeploymentRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  // Route matching
  // POST /v1/functions — Create
  // GET /v1/functions — List
  // GET /v1/functions/:id — Get
  // PUT /v1/functions/:id — Update
  // DELETE /v1/functions/:id — Delete
  // POST /v1/functions/:id/invoke — Invoke
  // GET /v1/functions/:id/logs — Get logs
  // GET /v1/invocations/:id — Get invocation

  // GET /v1/invocations/:id
  const invocationMatch = path.match(/^\/v1\/invocations\/([a-f0-9-]+)$/);
  if (invocationMatch && method === 'GET') {
    return handleGetInvocation(request, invocationMatch[1]);
  }

  // /v1/functions routes
  const functionIdMatch = path.match(/^\/v1\/functions\/([a-f0-9-]+)\/(.+)$/);
  const functionBaseMatch = path.match(/^\/v1\/functions\/([a-f0-9-]+)$/);

  if (path === '/v1/functions' || path === '/v1/functions/') {
    switch (method) {
      case 'POST':
        return handleCreateFunction(request);
      case 'GET':
        return handleListFunctions(request);
      default:
        return errorResponse('METHOD_NOT_ALLOWED', `Method ${method} not allowed`, 405);
    }
  }

  if (functionIdMatch) {
    const [, id, subPath] = functionIdMatch;
    switch (subPath) {
      case 'invoke':
        if (method === 'POST') {
          return handleInvokeFunction(request, id);
        }
        break;
      case 'logs':
        if (method === 'GET') {
          return handleGetLogs(request, id);
        }
        break;
    }
    return errorResponse('NOT_FOUND', 'Route not found', 404);
  }

  if (functionBaseMatch) {
    const [, id] = functionBaseMatch;
    switch (method) {
      case 'GET':
        return handleGetFunction(request, id);
      case 'PUT':
        return handleUpdateFunction(request, id);
      case 'DELETE':
        return handleDeleteFunctionRoute(request, id);
      default:
        return errorResponse('METHOD_NOT_ALLOWED', `Method ${method} not allowed`, 405);
    }
  }

  return errorResponse('NOT_FOUND', 'Route not found', 404);
}
