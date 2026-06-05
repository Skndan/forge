// Realtime — JWT Authentication for WebSocket connections
import * as jose from 'jose';

// ============================================================
// JWKS Cache (shared with Gateway pattern)
// ============================================================

interface JwksCacheEntry {
  keys: jose.UnsecuredJWK[];
  fetchedAt: number;
}

let jwksCache: JwksCacheEntry | null = null;
const JWKS_CACHE_TTL_MS = 15 * 60 * 1000;

function getJwksUrl(): string {
  return process.env.JWKS_URL || 'http://localhost:8080/realms/forge/protocol/openid-connect/certs';
}

async function fetchJWKS(): Promise<jose.UnsecuredJWK[]> {
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

// ============================================================
// Token Verification
// ============================================================

export interface RealtimeUser {
  sub: string;
  tenant_id: string;
  plan: string;
  roles: string[];
  [key: string]: unknown;
}

export async function verifyToken(token: string): Promise<RealtimeUser> {
  const keys = await fetchJWKS();
  const keySet = jose.createLocalJWKSet({ keys });
  const issuer = process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/forge';

  const { payload } = await jose.jwtVerify(token, keySet, {
    issuer,
    algorithms: ['RS256', 'RS384', 'RS512'],
  });

  return {
    sub: payload.sub as string,
    tenant_id: (payload.tenant_id as string) || '',
    plan: (payload.plan as string) || 'free',
    roles: (payload.roles as string[]) || [],
    ...payload,
  };
}

// ============================================================
// Token Extraction
// ============================================================

export function extractTokenFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url, 'http://localhost');
    return parsed.searchParams.get('token') || null;
  } catch {
    return null;
  }
}

export function extractTokenFromProtocol(
  protocols: string[],
): string | null {
  for (const p of protocols) {
    if (p.startsWith('token_')) {
      return p.slice(6);
    }
  }
  return null;
}
