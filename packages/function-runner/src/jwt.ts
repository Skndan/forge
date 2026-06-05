// Function Runner — Scoped JWT Per Invocation (FR-004)
// ============================================================
//
// Generates short-lived, scoped JWT tokens for each function invocation.
// These tokens limit what the function can access (specific tables, buckets)
// based on the function definition and the invoking user's permissions.

import { SignJWT } from 'jose';
import { config } from './config.js';

export interface ScopedJwtPayload {
  /** Function invocation ID */
  invocation_id: string;

  /** Function definition ID */
  function_id: string;

  /** Tenant ID */
  tenant_id: string;

  /** The user who invoked the function */
  invoked_by: string;

  /** Allowed tables for this invocation */
  allowed_tables?: string[];

  /** Allowed buckets for this invocation */
  allowed_buckets?: string[];

  /** Max queries per invocation */
  max_queries?: number;

  /** Token expiry timestamp */
  exp: number;

  /** Token issued-at timestamp */
  iat: number;

  /** Issuer */
  iss: string;

  /** Audience */
  aud: string;

  /** JWT ID (unique per token) */
  jti: string;
}

const encoder = new TextEncoder();

/**
 * Generate a scoped JWT for a function invocation.
 * The token is short-lived (default 60 seconds) and contains
 * the minimal set of claims needed for the function to operate.
 */
export async function generateScopedJwt(params: {
  invocationId: string;
  functionId: string;
  tenantId: string;
  invokedBy: string;
  allowedTables?: string[];
  allowedBuckets?: string[];
  maxQueries?: number;
  ttlSeconds?: number;
}): Promise<string> {
  const {
    invocationId,
    functionId,
    tenantId,
    invokedBy,
    allowedTables,
    allowedBuckets,
    maxQueries = 100,
    ttlSeconds = 60,
  } = params;

  const now = Math.floor(Date.now() / 1000);
  const secretKey = encoder.encode(config.jwtSecret);

  const token = await new SignJWT({
    invocation_id: invocationId,
    function_id: functionId,
    tenant_id: tenantId,
    invoked_by: invokedBy,
    allowed_tables: allowedTables,
    allowed_buckets: allowedBuckets,
    max_queries: maxQueries,
    jti: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .setIssuer(config.jwtIssuer)
    .setAudience(config.jwtAudience)
    .sign(secretKey);

  return token;
}

/**
 * Validate scoped JWT claims for a function execution context.
 * This is used within the function sandbox to enforce permissions.
 */
export function validateScope(
  token: ScopedJwtPayload,
  requiredTable?: string,
  requiredBucket?: string,
): { allowed: boolean; reason?: string } {
  if (Date.now() / 1000 > token.exp) {
    return { allowed: false, reason: 'Token expired' };
  }

  if (token.iss !== config.jwtIssuer) {
    return { allowed: false, reason: 'Invalid issuer' };
  }

  if (token.aud !== config.jwtAudience) {
    return { allowed: false, reason: 'Invalid audience' };
  }

  if (requiredTable && token.allowed_tables && !token.allowed_tables.includes(requiredTable)) {
    return { allowed: false, reason: `Table '${requiredTable}' not in allowed set` };
  }

  if (requiredBucket && token.allowed_buckets && !token.allowed_buckets.includes(requiredBucket)) {
    return { allowed: false, reason: `Bucket '${requiredBucket}' not in allowed set` };
  }

  return { allowed: true };
}

/**
 * Generate a default scoped payload for functions without explicit permissions.
 * This grants broad but tenant-scoped access.
 */
export function defaultScope(params: {
  invocationId: string;
  functionId: string;
  tenantId: string;
  invokedBy: string;
}): {
  allowedTables: string[];
  allowedBuckets: string[];
  maxQueries: number;
  ttlSeconds: number;
} {
  return {
    // By default, allow access to all tables and buckets within the tenant
    allowedTables: ['*'],
    allowedBuckets: ['*'],
    maxQueries: 100,
    ttlSeconds: 60,
  };
}
