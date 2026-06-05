// Gateay — Auth & JWT utilities
import * as jose from 'jose';

// ============================================================
// JWKS Cache
// ============================================================

interface JwksCacheEntry {
  keys: jose.UnsecuredJWK[];
  fetchedAt: number;
}

let jwksCache: JwksCacheEntry | null = null;
const JWKS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function getJwksUrl(): string {
  return process.env.JWKS_URL || 'http://localhost:8080/realms/forge/protocol/openid-connect/certs';
}

export async function fetchJWKS(): Promise<jose.UnsecuredJWK[]> {
  const now = Date.now();

  if (jwksCache && now - jwksCache.fetchedAt < JWKS_CACHE_TTL_MS) {
    return jwksCache.keys;
  }

  const url = getJwksUrl();
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { keys: jose.UnsecuredJWK[] };
  jwksCache = { keys: data.keys, fetchedAt: now };

  return data.keys;
}

export function clearJwksCache(): void {
  jwksCache = null;
}

// ============================================================
// JWT Verification
// ============================================================

export interface VerifiedToken {
  sub: string;
  tenant_id?: string;
  plan?: string;
  roles?: string[];
  client_roles?: string[];
  [key: string]: unknown;
}

export async function verifyToken(token: string): Promise<VerifiedToken> {
  try {
    const keys = await fetchJWKS();
    const keySet = jose.createLocalJWKSet({ keys });

    const issuer = process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/forge';

    const { payload } = await jose.jwtVerify(token, keySet, {
      issuer,
      algorithms: ['RS256', 'RS384', 'RS512'],
    });

    return payload as unknown as VerifiedToken;
  } catch (err) {
    throw new Error(`Token verification failed: ${(err as Error).message}`);
  }
}

// ============================================================
// Token Extraction
// ============================================================

export function extractToken(authorization?: string): string | null {
  if (!authorization) return null;
  const parts = authorization.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1];
}
