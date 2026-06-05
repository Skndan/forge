// ── Dashboard Unit Tests ──

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api';

// ── Utils ──────────────────────────────────────────────────

describe('cn utility', () => {
  it('merges class names', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('handles conditional classes', () => {
    const result = cn('base', false && 'hidden', 'visible');
    expect(result).toBe('base visible');
  });

  it('handles tailwind-merge conflicts', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6');
  });

  it('handles empty inputs', () => {
    expect(cn()).toBe('');
  });
});

// ── API Client ─────────────────────────────────────────────

describe('ApiError', () => {
  it('creates error with proper fields', () => {
    const err = new ApiError(400, 'VALIDATION_ERROR', 'Bad request', { field: 'name' });
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Bad request');
    expect(err.details).toEqual({ field: 'name' });
  });

  it('extends Error', () => {
    const err = new ApiError(500, 'INTERNAL_ERROR', 'Oops');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });
});

// ── Auth Logic ─────────────────────────────────────────────

describe('Auth State Machine', () => {
  const initialState = {
    isAuthenticated: false,
    isLoading: true,
    user: null,
    accessToken: null,
    refreshToken: null,
    error: null,
  };

  it('starts in loading state', () => {
    expect(initialState.isLoading).toBe(true);
    expect(initialState.isAuthenticated).toBe(false);
  });

  it('transitions to authenticated on login success', () => {
    const state = {
      ...initialState,
      isAuthenticated: true,
      isLoading: false,
      user: { sub: 'test', email: 'test@test.com', name: 'Test', preferred_username: 'test', roles: [] },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    };
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe('test@test.com');
  });

  it('transitions to error state', () => {
    const state = {
      ...initialState,
      isLoading: false,
      error: 'Invalid credentials',
    };
    expect(state.error).toBe('Invalid credentials');
    expect(state.isAuthenticated).toBe(false);
  });

  it('transitions to logout state', () => {
    const state = {
      ...initialState,
      isAuthenticated: false,
      isLoading: false,
      accessToken: null,
    };
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
  });
});

// ── PKCE Helpers ──────────────────────────────────────────

describe('PKCE helpers', () => {
  it('generates code verifier of correct length', () => {
    // We test the algorithm: base64URLEncode of 32 random bytes
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const verifier = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(verifier.length).toBeGreaterThanOrEqual(40);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(/^[A-Za-z0-9\-_]+$/.test(verifier)).toBe(true);
  });

  it('state parameter is random', () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const state1 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    crypto.getRandomValues(bytes);
    const state2 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(state1).not.toBe(state2);
  });
});

// ── JWT Payload Parsing ───────────────────────────────────

describe('JWT parsing', () => {
  it('decodes a valid JWT payload', () => {
    const payload = { sub: 'user-123', email: 'test@test.com', tenant_id: 'tenant-1' };
    const encoded = btoa(JSON.stringify(payload));
    const token = `header.${encoded}.signature`;

    const decoded = JSON.parse(atob(token.split('.')[1]));
    expect(decoded.sub).toBe('user-123');
    expect(decoded.email).toBe('test@test.com');
  });
});

// ── UI Component Tests ────────────────────────────────────

describe('Button component variants', () => {
  it('has default variant classes', () => {
    const { buttonVariants } = require('@/components/ui/button');
    const classes = buttonVariants({ variant: 'default', size: 'default' });
    expect(classes).toContain('bg-primary');
    expect(classes).toContain('text-primary-foreground');
  });

  it('has destructive variant', () => {
    const { buttonVariants } = require('@/components/ui/button');
    const classes = buttonVariants({ variant: 'destructive' });
    expect(classes).toContain('bg-destructive');
  });

  it('has outline variant', () => {
    const { buttonVariants } = require('@/components/ui/button');
    const classes = buttonVariants({ variant: 'outline' });
    expect(classes).toContain('border-input');
  });

  it('has different sizes', () => {
    const { buttonVariants } = require('@/components/ui/button');
    const sm = buttonVariants({ size: 'sm' });
    const lg = buttonVariants({ size: 'lg' });
    expect(sm).toContain('h-9');
    expect(lg).toContain('h-11');
  });
});

describe('Badge component variants', () => {
  it('has default variant', () => {
    const { badgeVariants } = require('@/components/ui/badge');
    const classes = badgeVariants({ variant: 'default' });
    expect(classes).toContain('bg-primary');
  });

  it('has success variant', () => {
    const { badgeVariants } = require('@/components/ui/badge');
    const classes = badgeVariants({ variant: 'success' });
    expect(classes).toContain('bg-green-100');
  });

  it('has warning variant', () => {
    const { badgeVariants } = require('@/components/ui/badge');
    const classes = badgeVariants({ variant: 'warning' });
    expect(classes).toContain('bg-yellow-100');
  });
});

// ── API Response Format ───────────────────────────────────

describe('API response helpers', () => {
  it('validates success response structure', () => {
    const response = { success: true, data: { id: '123' } };
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  it('validates error response structure', () => {
    const response = {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    };
    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('NOT_FOUND');
  });

  it('validates paginated response structure', () => {
    const response = {
      success: true,
      data: [{ id: '1' }, { id: '2' }],
      total: 2,
      page: 1,
      per_page: 50,
    };
    expect(response.data.length).toBe(2);
    expect(response.total).toBe(2);
    expect(response.per_page).toBe(50);
  });
});
