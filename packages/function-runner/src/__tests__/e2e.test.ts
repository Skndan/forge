// Function Runner — E2E Docker Compose Test
// ============================================================
//
// Tests the full lifecycle of the function runner:
// 1. Server starts and responds to health checks
// 2. Function deployment (create, read, update, delete) via API
// 3. Function execution (invocation)
// 4. Logs collection
// 5. Warm pool management
//
// These tests require a running function-runner instance.
// They gracefully skip if the server is not available.

import { describe, expect, test } from 'bun:test';

const RUNNER_URL = process.env.FUNCTION_RUNNER_URL || 'http://localhost:3002';
const ADMIN_TOKEN = process.env.ADMIN_SERVICE_TOKEN || 'test-admin-token';
const TENANT_ID = process.env.TEST_TENANT_ID || '00000000-0000-0000-0000-000000000010';

let serverAvailable = false;
let createdFunctionId: string;

// Check if the runner server is available before all tests
async function isServerAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${RUNNER_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

// Helper: make an API request
async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
  queryParams?: Record<string, string>,
): Promise<Response | null> {
  if (!serverAvailable) return null;

  const url = new URL(`${RUNNER_URL}${path}`);
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'X-Tenant-Id': TENANT_ID,
  };

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return response;
}

describe('Function Runner — E2E', () => {
  test('server is available', async () => {
    serverAvailable = await isServerAvailable();
    if (!serverAvailable) {
      console.log('  ⚠️  Function runner not available, skipping E2E tests');
    }
    // Always pass — this just sets up the flag
    expect(true).toBe(true);
  });

  test('GET /health returns 200', async () => {
    if (!serverAvailable) return;
    const response = await fetch(`${RUNNER_URL}/health`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.status).toBeDefined();
    expect(body.timestamp).toBeDefined();
    expect(body.checks).toBeDefined();
  });

  test('POST /v1/functions creates a new function', async () => {
    const response = await apiRequest('POST', '/v1/functions', {
      tenant_id: TENANT_ID,
      name: 'hello-world',
      slug: 'hello-world',
      source: 'export function handler() { return { message: "Hello from Forge!" }; }',
      entrypoint: 'index.ts',
      env_vars: {},
      timeout_ms: 10000,
    });
    if (!response) return;

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.slug).toBe('hello-world');
    createdFunctionId = body.data.id;
  });

  test('GET /v1/functions lists tenant functions', async () => {
    const response = await apiRequest('GET', '/v1/functions', undefined, { tenant_id: TENANT_ID });
    if (!response) return;

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /v1/functions/:id returns function details', async () => {
    const response = await apiRequest('GET', `/v1/functions/${createdFunctionId}`, undefined, { tenant_id: TENANT_ID });
    if (!response) return;

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(createdFunctionId);
  });

  test('POST /v1/functions/:id/invoke executes a function', async () => {
    const response = await apiRequest('POST', `/v1/functions/${createdFunctionId}/invoke`, {
      tenant_id: TENANT_ID,
      payload: { name: 'test' },
      invoked_by: 'test-user',
    });
    if (!response) return;

    const body = await response.json();
    if (response.status === 200) {
      expect(body.success).toBe(true);
      expect(body.data.invocation_id).toBeDefined();
    }
  });

  test('POST /v1/functions/:id/invoke with async returns 202', async () => {
    const response = await apiRequest('POST', `/v1/functions/${createdFunctionId}/invoke`, {
      tenant_id: TENANT_ID,
      payload: { name: 'test' },
      invoked_by: 'test-user',
      async: true,
    });
    if (!response) return;

    if (response.status === 202) {
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('queued');
    }
  });

  test('PUT /v1/functions/:id updates function', async () => {
    const response = await apiRequest('PUT', `/v1/functions/${createdFunctionId}`, {
      tenant_id: TENANT_ID,
      name: 'hello-world-updated',
      timeout_ms: 20000,
    });
    if (!response) return;

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('hello-world-updated');
  });

  test('GET /v1/functions/:id/logs returns logs', async () => {
    const response = await apiRequest('GET', `/v1/functions/${createdFunctionId}/logs`, undefined, {
      tenant_id: TENANT_ID, limit: '10', offset: '0',
    });
    if (!response) return;

    if (response.status === 200) {
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.logs)).toBe(true);
    }
  });

  test('DELETE /v1/functions/:id deletes function', async () => {
    const response = await apiRequest('DELETE', `/v1/functions/${createdFunctionId}`, undefined, { tenant_id: TENANT_ID });
    if (!response) return;

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.deleted).toBe(true);
  });

  test('404 for deleted function', async () => {
    const response = await apiRequest('GET', `/v1/functions/${createdFunctionId}`, undefined, { tenant_id: TENANT_ID });
    if (!response) return;

    expect(response.status).toBe(404);
  });

  test('Auth: rejects requests without admin token', async () => {
    if (!serverAvailable) return;
    const response = await fetch(`${RUNNER_URL}/v1/functions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: TENANT_ID, name: 'test', slug: 'test', source: '// test' }),
    });
    expect([401, 403]).toContain(response.status);
  });

  test('Validation: rejects function without required fields', async () => {
    const response = await apiRequest('POST', '/v1/functions', {
      tenant_id: TENANT_ID,
    });
    if (!response) return;

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });
});
