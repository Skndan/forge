// ── Auth Context — Manages auth state for the dashboard ──

'use client';

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';

// Types
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserInfo | null;
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
}

export interface UserInfo {
  sub: string;
  email: string;
  name: string;
  preferred_username: string;
  tenant_id?: string;
  roles: string[];
}

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: UserInfo; accessToken: string; refreshToken: string } }
  | { type: 'LOGIN_ERROR'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'TOKEN_REFRESHED'; payload: { accessToken: string } }
  | { type: 'SET_LOADING'; payload: boolean };

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  accessToken: null,
  refreshToken: null,
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoading: true, error: null };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        isLoading: false,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
        error: null,
      };
    case 'LOGIN_ERROR':
      return { ...state, isLoading: false, error: action.payload };
    case 'LOGOUT':
      return { ...initialState, isLoading: false };
    case 'TOKEN_REFRESHED':
      return { ...state, accessToken: action.payload.accessToken };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

// Context
interface AuthContextType {
  state: AuthState;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Configuration
const KEYCLOAK_URL = process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'forge';
const CLIENT_ID = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'forge-dashboard';
const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3000';
const REDIRECT_URI = typeof window !== 'undefined' ? `${window.location.origin}/login/callback` : '';
const KEYCLOAK_BASE = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect`;

// PKCE helpers
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(digest));
}

function base64URLEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

function parseJWT(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return {};
  }
}

// Provider
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem('forge_access_token');
      const storedRefresh = localStorage.getItem('forge_refresh_token');

      if (storedToken && storedRefresh) {
        try {
          // Check if token is expired
          const payload = parseJWT(storedToken);
          const exp = payload.exp as number;
          const now = Math.floor(Date.now() / 1000);

          if (exp < now) {
            // Try to refresh
            await performTokenRefresh(storedRefresh);
          } else {
            const user: UserInfo = {
              sub: (payload.sub as string) || '',
              email: (payload.email as string) || '',
              name: (payload.name as string) || (payload.preferred_username as string) || '',
              preferred_username: (payload.preferred_username as string) || '',
              tenant_id: (payload.tenant_id as string) || undefined,
              roles: (payload.roles as string[]) || [],
            };
            dispatch({
              type: 'LOGIN_SUCCESS',
              payload: { user, accessToken: storedToken, refreshToken: storedRefresh },
            });
            return;
          }
        } catch {
          // Token invalid, clear
          localStorage.removeItem('forge_access_token');
          localStorage.removeItem('forge_refresh_token');
        }
      }
      dispatch({ type: 'SET_LOADING', payload: false });
    };

    restoreSession();
  }, []);

  const performTokenRefresh = async (refreshToken: string): Promise<void> => {
    try {
      const response = await fetch(`${KEYCLOAK_BASE}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) throw new Error('Token refresh failed');

      const data = await response.json();
      const newPayload = parseJWT(data.access_token);
      const user: UserInfo = {
        sub: (newPayload.sub as string) || '',
        email: (newPayload.email as string) || '',
        name: (newPayload.name as string) || (newPayload.preferred_username as string) || '',
        preferred_username: (newPayload.preferred_username as string) || '',
        tenant_id: (newPayload.tenant_id as string) || undefined,
        roles: (newPayload.roles as string[]) || [],
      };

      localStorage.setItem('forge_access_token', data.access_token);
      localStorage.setItem('forge_refresh_token', data.refresh_token);

      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { user, accessToken: data.access_token, refreshToken: data.refresh_token },
      });
    } catch {
      dispatch({ type: 'LOGOUT' });
    }
  };

  const login = useCallback(async () => {
    dispatch({ type: 'LOGIN_START' });

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Store PKCE state
    sessionStorage.setItem('forge_code_verifier', codeVerifier);
    sessionStorage.setItem('forge_oauth_state', state);

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      scope: 'openid profile email',
    });

    window.location.href = `${KEYCLOAK_BASE}/auth?${params.toString()}`;
  }, []);

  const handleCallback = useCallback(async (code: string, state: string) => {
    const storedState = sessionStorage.getItem('forge_oauth_state');
    if (state !== storedState) {
      dispatch({ type: 'LOGIN_ERROR', payload: 'State mismatch - possible CSRF attack' });
      return;
    }

    const codeVerifier = sessionStorage.getItem('forge_code_verifier');
    if (!codeVerifier) {
      dispatch({ type: 'LOGIN_ERROR', payload: 'Code verifier not found' });
      return;
    }

    // Clean up session storage
    sessionStorage.removeItem('forge_code_verifier');
    sessionStorage.removeItem('forge_oauth_state');

    try {
      const response = await fetch(`${KEYCLOAK_BASE}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
          code_verifier: codeVerifier,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Token exchange failed: ${errorData}`);
      }

      const data = await response.json();
      const payload = parseJWT(data.access_token);
      const user: UserInfo = {
        sub: (payload.sub as string) || '',
        email: (payload.email as string) || '',
        name: (payload.name as string) || (payload.preferred_username as string) || '',
        preferred_username: (payload.preferred_username as string) || '',
        tenant_id: (payload.tenant_id as string) || undefined,
        roles: (payload.roles as string[]) || [],
      };

      localStorage.setItem('forge_access_token', data.access_token);
      localStorage.setItem('forge_refresh_token', data.refresh_token);

      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { user, accessToken: data.access_token, refreshToken: data.refresh_token },
      });
    } catch (err) {
      dispatch({
        type: 'LOGIN_ERROR',
        payload: (err as Error).message,
      });
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const token = localStorage.getItem('forge_access_token');
      if (token) {
        // Attempt to logout from Keycloak
        await fetch(`${KEYCLOAK_BASE}/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: CLIENT_ID,
            refresh_token: localStorage.getItem('forge_refresh_token') || '',
          }),
        });
      }
    } catch {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('forge_access_token');
      localStorage.removeItem('forge_refresh_token');
      dispatch({ type: 'LOGOUT' });
      window.location.href = '/login';
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const storedRefresh = localStorage.getItem('forge_refresh_token');
    if (storedRefresh) {
      await performTokenRefresh(storedRefresh);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ state, login, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { handleCallback as processAuthCallback };
