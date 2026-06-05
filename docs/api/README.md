# Forge API Reference

> Complete API reference for the Forge BaaS platform.

Base URL: `http://localhost:3000` (or your deployed gateway URL)

---

## Table of Contents

- [Authentication](#authentication)
- [Health](#health)
- [Metrics](#metrics)
- [Database](#database)
- [Storage](#storage)
- [Functions](#functions)
- [Webhooks](#webhooks)
- [Auth Routes](#auth-routes)
- [Admin Routes](#admin-routes)
- [Error Codes](#error-codes)

---

## Authentication

Most endpoints require a Bearer JWT token obtained from Keycloak.

### Get Token

```http
POST http://localhost:8080/realms/forge/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

client_id=forge-api
client_secret=CHANGE_ME
grant_type=password
username=admin
password=admin
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "expires_in": 300,
  "refresh_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_expires_in": 1800,
  "token_type": "Bearer"
}
```

### Use Token

```
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

---

## Health

### `GET /v1/health`

Returns the health status of all dependencies.

**Rate limited:** No

**Response `200` (healthy):**

```json
{
  "success": true,
  "status": "healthy",
  "version": "0.5.0",
  "timestamp": "2026-06-05T07:00:00.000Z",
  "uptime": 3600,
  "service": "forge-gateway",
  "checks": [
    { "name": "jwks", "status": "ok", "latency": 45 },
    { "name": "postgres", "status": "ok", "latency": 12 },
    { "name": "storage", "status": "ok", "latency": 23 },
    { "name": "valkey", "status": "ok", "latency": 8 }
  ]
}
```

**Response `503` (degraded/unhealthy):**

```json
{
  "success": false,
  "status": "degraded",
  "version": "0.5.0",
  "timestamp": "2026-06-05T07:00:00.000Z",
  "uptime": 3600,
  "service": "forge-gateway",
  "checks": [
    { "name": "jwks", "status": "ok", "latency": 45 },
    { "name": "postgres", "status": "ok", "latency": 12 },
    { "name": "storage", "status": "error", "latency": 5000, "error": "Unreachable" },
    { "name": "valkey", "status": "ok", "latency": 8 }
  ]
}
```

---

## Metrics

### `GET /metrics`

Prometheus-format metrics endpoint.

**Rate limited:** No

**Response** (`text/plain`):

```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/v1/health",service="forge-gateway"} 42
http_requests_total{status="2xx",service="forge-gateway"} 38
http_requests_total{status="4xx",service="forge-gateway"} 4

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{service="forge-gateway",le="0.005"} 30
http_request_duration_seconds_bucket{service="forge-gateway",le="0.01"} 35
http_request_duration_seconds_bucket{service="forge-gateway",le="+Inf"} 42
http_request_duration_seconds_sum{service="forge-gateway"} 2.5
http_request_duration_seconds_count{service="forge-gateway"} 42

# HELP up Service up status
# TYPE up gauge
up{service="forge-gateway"} 1
```

---

## Database

### `POST /v1/db/query`

Execute a SQL query with RLS enforcement.

**Rate limited:** Yes  
**Auth required:** Bearer JWT

**Request:**

```json
{
  "query": "SELECT * FROM forge.users WHERE id = $1",
  "params": ["00000000-0000-0000-0000-000000000001"]
}
```

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "00000000-0000-0000-0000-000000000001",
      "email": "user@example.com",
      "created_at": "2026-01-01T00:00:00.000Z"
    }
  ],
  "row_count": 1
}
```

**Response `400` (validation error):**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Query string is required"
  }
}
```

**Response `403` (forbidden query):**

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Only SELECT queries are allowed"
  }
}
```

> **Note:** Only `SELECT` queries are permitted from client-facing API. Mutations go through the SDK or admin routes.

---

## Storage

### `POST /v1/storage/upload-url`

Generate a presigned upload URL.

**Rate limited:** Yes  
**Auth required:** Bearer JWT

**Request:**

```json
{
  "bucket": "my-bucket",
  "path": "uploads/file.txt",
  "content_type": "text/plain",
  "size": 1024
}
```

**Response `200`:**

```json
{
  "success": true,
  "upload_url": "http://rustfs:9000/my-bucket/uploads/file.txt?...",
  "public_url": "http://localhost:9000/my-bucket/uploads/file.txt",
  "expires_in": 3600
}
```

**Response `400`:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "bucket and path are required"
  }
}
```

### `GET /v1/storage/download-url`

Generate a presigned download URL.

**Rate limited:** Yes  
**Auth required:** Bearer JWT

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| bucket | string | Yes | Bucket name |
| path | string | Yes | Object path |

**Response `200`:**

```json
{
  "success": true,
  "download_url": "http://rustfs:9000/my-bucket/uploads/file.txt?...",
  "expires_in": 3600
}
```

---

## Functions

### `POST /v1/functions/invoke`

Invoke a serverless function.

**Rate limited:** Yes  
**Auth required:** Bearer JWT

**Request:**

```json
{
  "function_id": "00000000-0000-0000-0000-000000000001",
  "payload": { "foo": "bar" },
  "async": false
}
```

**Response `200` (sync):**

```json
{
  "success": true,
  "data": { "result": "function output here" },
  "execution_time_ms": 45
}
```

**Response `202` (async):**

```json
{
  "success": true,
  "message": "Function invocation queued",
  "invocation_id": "inv_abc123"
}
```

**Response `404`:**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Function not found or inactive"
  }
}
```

---

## Webhooks

### `POST /v1/webhooks`

Create a webhook subscription.

**Rate limited:** Yes  
**Auth required:** Bearer JWT

**Request:**

```json
{
  "name": "user-created-notifier",
  "url": "https://example.com/webhook",
  "events": ["user.created", "user.updated"],
  "secret": "my_webhook_secret"
}
```

**Response `201`:**

```json
{
  "success": true,
  "data": {
    "id": "00000000-0000-0000-0000-000000000001",
    "name": "user-created-notifier",
    "url": "https://example.com/webhook",
    "events": ["user.created", "user.updated"],
    "active": true,
    "created_at": "2026-06-05T07:00:00.000Z"
  }
}
```

### `GET /v1/webhooks`

List all webhook subscriptions.

**Rate limited:** Yes  
**Auth required:** Bearer JWT

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "00000000-0000-0000-0000-000000000001",
      "name": "user-created-notifier",
      "url": "https://example.com/webhook",
      "events": ["user.created", "user.updated"],
      "active": true
    }
  ]
}
```

---

## Auth Routes

### `GET /v1/auth/me`

Get current user profile from JWT claims.

**Rate limited:** Yes  
**Auth required:** Bearer JWT

**Response `200`:**

```json
{
  "success": true,
  "user": {
    "sub": "user-uuid",
    "tenant_id": "tenant-uuid",
    "plan": "pro",
    "roles": ["user"],
    "iat": 1704067200,
    "exp": 1704070800
  }
}
```

**Response `401`:**

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing authorization header"
  }
}
```

---

## Admin Routes

Admin routes use `X-Admin-Token` header instead of Bearer JWT.

### `GET /v1/admin/tenants`

List all tenants.

**Auth required:** X-Admin-Token

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "tenant-uuid",
      "name": "My Tenant",
      "plan": "pro"
    }
  ]
}
```

### `GET /v1/admin/users`

List all users.

**Auth required:** X-Admin-Token

### `GET /v1/admin/storage`

List storage buckets and metadata.

**Auth required:** X-Admin-Token

---

## Error Codes

| Code | Status | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request body/params |
| `RATE_LIMITED` | 429 | Too many requests (retry after 60s) |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `QUERY_FAILED` | 400 | Database query execution failed |
| `FUNCTION_ERROR` | 500 | Function invocation error |

---

## Headers

| Header | Description |
|---|---|
| `Authorization: Bearer <token>` | Standard JWT auth |
| `X-Admin-Token: <token>` | Admin service token |
| `X-Tenant-Id: <uuid>` | Tenant context (internal) |
| `X-Correlation-Id: <string>` | Request tracing |

---

## Rate Limiting

- Default limit: 100 requests/minute per IP
- `/v1/health` and `/metrics` are excluded from rate limiting
- Rate limited endpoints return `429` with `Retry-After: 60` header
- Configure via `RATE_LIMIT_MAX` env var
