// ── API Client — JWT-authenticated HTTP client ──

'use client';

import type { ApiResponse, User, Tenant, Bucket, FunctionDefinition, WebhookSubscription } from '@forge/types';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3000';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('forge_access_token');
}

function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('forge_admin_service_token');
}

async function request<T>(
  path: string,
  method: HttpMethod = 'GET',
  body?: unknown,
  useAdminToken = false,
): Promise<T> {
  const token = useAdminToken ? getAdminToken() : getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (useAdminToken) {
    const adminToken = getAdminToken();
    if (adminToken) {
      headers['X-Admin-Token'] = adminToken;
    }
  }

  const response = await fetch(`${GATEWAY_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await response.json()) as ApiResponse<T>;

  if (!data.success || !response.ok) {
    throw new ApiError(
      response.status,
      data.error?.code || 'UNKNOWN',
      data.error?.message || 'An error occurred',
      data.error?.details,
    );
  }

  return data.data as T;
}

// ── Tenants ──────────────────────────────────────────────────

export async function listTenants(): Promise<Tenant[]> {
  return request<Tenant[]>('/v1/admin/tenants');
}

// ── Users ────────────────────────────────────────────────────

export async function listUsers(): Promise<User[]> {
  return request<User[]>('/v1/admin/users', 'GET', undefined, true);
}

export async function getUser(id: string): Promise<User> {
  return request<User>(`/v1/admin/users/${id}`, 'GET', undefined, true);
}

export async function updateUser(id: string, data: Partial<User>): Promise<User> {
  return request<User>(`/v1/admin/users/${id}`, 'PATCH', data, true);
}

// ── Database / Table Browser ─────────────────────────────────

export async function listTables(): Promise<{ table_name: string; table_schema: string }[]> {
  return request('/v1/admin/tables', 'GET', undefined, true) as Promise<
    { table_name: string; table_schema: string }[]
  >;
}

export async function getTableInfo(schema: string, table: string): Promise<{
  columns: Record<string, unknown>[];
  policies: Record<string, unknown>[];
}> {
  return request(`/v1/admin/tables/${schema}/${table}`, 'GET', undefined, true) as Promise<{
    columns: Record<string, unknown>[];
    policies: Record<string, unknown>[];
  }>;
}

export async function queryTable(
  schema: string,
  table: string,
  options?: { limit?: number; offset?: number; orderBy?: string; where?: string },
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  if (options?.orderBy) params.set('order_by', options.orderBy);
  if (options?.where) params.set('where', options.where);

  const qs = params.toString();
  return request(
    `/v1/admin/tables/${schema}/${table}/rows${qs ? `?${qs}` : ''}`,
    'GET',
    undefined,
    true,
  );
}

export async function insertRow(schema: string, table: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  return request(`/v1/admin/tables/${schema}/${table}/rows`, 'POST', data, true);
}

export async function updateRow(
  schema: string,
  table: string,
  id: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return request(`/v1/admin/tables/${schema}/${table}/rows/${id}`, 'PATCH', data, true);
}

export async function deleteRow(schema: string, table: string, id: string): Promise<void> {
  return request(`/v1/admin/tables/${schema}/${table}/rows/${id}`, 'DELETE', undefined, true);
}

export async function upsertRlsPolicy(
  schema: string,
  table: string,
  policy: Record<string, unknown>,
): Promise<void> {
  return request(`/v1/admin/tables/${schema}/${table}/policies`, 'POST', policy, true);
}

export async function deleteRlsPolicy(
  schema: string,
  table: string,
  policyName: string,
): Promise<void> {
  return request(`/v1/admin/tables/${schema}/${table}/policies/${policyName}`, 'DELETE', undefined, true);
}

// ── Storage ──────────────────────────────────────────────────

export async function listBuckets(): Promise<Bucket[]> {
  return request<Bucket[]>('/v1/admin/storage/buckets', 'GET', undefined, true);
}

export async function createBucket(data: Partial<Bucket>): Promise<Bucket> {
  return request<Bucket>('/v1/admin/storage/buckets', 'POST', data, true);
}

export async function listFiles(bucket: string, prefix?: string): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({ bucket });
  if (prefix) params.set('prefix', prefix);
  return request(`/v1/admin/storage/files?${params.toString()}`, 'GET', undefined, true);
}

export async function uploadFile(bucket: string, path: string, file: Blob): Promise<void> {
  // Get presigned URL first
  const { url } = await request<{ url: string; method: string }>(
    '/v1/storage/upload-url',
    'POST',
    { bucket, path, content_type: file.type, size_bytes: file.size },
  );

  // Upload directly to storage
  const uploadResponse = await fetch(url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });

  if (!uploadResponse.ok) {
    throw new ApiError(500, 'UPLOAD_ERROR', 'File upload failed');
  }
}

// ── Webhooks ─────────────────────────────────────────────────

export async function listWebhooks(): Promise<WebhookSubscription[]> {
  return request<WebhookSubscription[]>('/v1/admin/webhooks', 'GET', undefined, true);
}

export async function createWebhook(data: Record<string, unknown>): Promise<WebhookSubscription> {
  return request<WebhookSubscription>('/v1/admin/webhooks', 'POST', data, true);
}

export async function updateWebhook(id: string, data: Record<string, unknown>): Promise<WebhookSubscription> {
  return request<WebhookSubscription>(`/v1/admin/webhooks/${id}`, 'PATCH', data, true);
}

export async function deleteWebhook(id: string): Promise<void> {
  return request(`/v1/admin/webhooks/${id}`, 'DELETE', undefined, true);
}

export async function listWebhookDeliveries(webhookId: string): Promise<Record<string, unknown>[]> {
  return request(`/v1/admin/webhooks/${webhookId}/deliveries`, 'GET', undefined, true);
}

// ── Functions ────────────────────────────────────────────────

export async function listFunctions(): Promise<FunctionDefinition[]> {
  return request<FunctionDefinition[]>('/v1/admin/functions', 'GET', undefined, true);
}

export async function createFunction(data: Record<string, unknown>): Promise<FunctionDefinition> {
  return request<FunctionDefinition>('/v1/admin/functions', 'POST', data, true);
}

export async function updateFunction(id: string, data: Record<string, unknown>): Promise<FunctionDefinition> {
  return request<FunctionDefinition>(`/v1/admin/functions/${id}`, 'PATCH', data, true);
}

export async function deleteFunction(id: string): Promise<void> {
  return request(`/v1/admin/functions/${id}`, 'DELETE', undefined, true);
}

export async function testInvokeFunction(id: string, payload: unknown): Promise<unknown> {
  return request(`/v1/admin/functions/${id}/invoke`, 'POST', { payload }, true);
}

// ── RBAC ─────────────────────────────────────────────────────

export async function listRoles(): Promise<Record<string, unknown>[]> {
  return request('/v1/admin/roles', 'GET', undefined, true) as Promise<Record<string, unknown>[]>;
}

export async function createRole(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  return request('/v1/admin/roles', 'POST', data, true);
}

export async function deleteRole(id: string): Promise<void> {
  return request(`/v1/admin/roles/${id}`, 'DELETE', undefined, true);
}

export async function listPermissions(): Promise<Record<string, unknown>[]> {
  return request('/v1/admin/permissions', 'GET', undefined, true) as Promise<Record<string, unknown>[]>;
}

export async function assignRole(userId: string, roleId: string): Promise<void> {
  return request(`/v1/admin/users/${userId}/roles`, 'POST', { role_id: roleId }, true);
}

export async function removeRole(userId: string, roleId: string): Promise<void> {
  return request(`/v1/admin/users/${userId}/roles/${roleId}`, 'DELETE', undefined, true);
}

// ── Health ───────────────────────────────────────────────────

export async function getHealth(): Promise<{ status: string; checks: Record<string, string> }> {
  return request('/v1/admin/health', 'GET', undefined, true);
}
