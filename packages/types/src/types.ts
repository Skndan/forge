// ============================================================
// Forge — Shared Type Definitions
// ============================================================

// ── Auth ─────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;
  tenant_id: string;
  plan: string;
  roles: string[];
  exp: number;
  iat: number;
}

export interface CurrentUser {
  id: string;
  tenant_id: string;
  plan: string;
  roles: string[];
  email?: string;
}

// ── Tenant ───────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  created_at: string;
  updated_at: string;
}

// ── User ─────────────────────────────────────────────────────

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

// ── Storage ──────────────────────────────────────────────────

export interface StorageMetadata {
  id: string;
  tenant_id: string;
  bucket: string;
  path: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

// ── Functions ────────────────────────────────────────────────

export interface FunctionDefinition {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  runtime: 'bun' | 'node';
  source: string;
  entrypoint: string;
  env_vars: Record<string, string>;
  timeout_ms: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Webhooks ─────────────────────────────────────────────────

export interface WebhookSubscription {
  id: string;
  tenant_id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  subscription_id: string;
  event: string;
  payload: unknown;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  next_retry_at?: string;
  created_at: string;
}

// ── Audit ────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  tenant_id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

// ── API Responses ────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  per_page: number;
}

// ── Request Bodies ───────────────────────────────────────────

export interface DbQueryRequest {
  query: string;
  params?: unknown[];
}

export interface StorageUploadUrlRequest {
  bucket: string;
  path: string;
  content_type: string;
  size_bytes: number;
}

export interface StorageDownloadUrlRequest {
  bucket: string;
  path: string;
}

export interface FunctionInvokeRequest {
  function_id: string;
  payload: unknown;
  async?: boolean;
}

export interface WebhookCreateRequest {
  name: string;
  url: string;
  events: string[];
  secret?: string;
}

// ── Realtime ──────────────────────────────────────────────────

export interface RealtimeSubscription {
  id: string;
  tenant_id: string;
  table: string;
  filter?: Record<string, unknown>;
  row_id?: string;
  created_at: string;
}

export interface RealtimeMessage {
  table: string;
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  id: string;
  tenant_id: string;
  payload?: Record<string, unknown>;
}

// ── Bucket ────────────────────────────────────────────────────

export interface Bucket {
  id: string;
  tenant_id: string;
  name: string;
  public: boolean;
  allowed_mime_types?: string[];
  max_file_size_bytes?: number;
  created_at: string;
  updated_at: string;
}

// ── Scheduler ─────────────────────────────────────────────────

export interface ScheduledFunction {
  id: string;
  tenant_id: string;
  function_id: string;
  cron_expression: string;
  is_active: boolean;
  last_run_at?: string;
  next_run_at?: string;
  created_at: string;
  updated_at: string;
}

// ── Error Codes ──────────────────────────────────────────────

export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  QUERY_ERROR: 'QUERY_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  FUNCTION_ERROR: 'FUNCTION_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
