# Forge Architecture Guide

> Architecture overview, data flow, security model, and scaling patterns.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Data Flow](#data-flow)
- [Security Model](#security-model)
- [Service Responsibilities](#service-responsibilities)
- [Sequence Diagrams](#sequence-diagrams)
- [Scaling Patterns](#scaling-patterns)

---

## System Architecture

Forge is a microservices-based Backend-as-a-Service with a single API gateway, polyglot backends, and a focus on developer experience.

```
                        ┌──────────────────────┐
                        │    External Clients   │
                        │ (Mobile, Web, CLI)    │
                        └──────────┬───────────┘
                                   │
                          ┌────────▼────────┐
                          │     Gateway      │
                          │  (Bun + Fastify) │
                          │  JWT Auth ───────│──── Keycloak (JWKS)
                          │  Rate Limiting   │
                          │  CORS            │
                          └──┬────┬────┬────┘
                             │    │    │
                  ┌──────────┘    │    └──────────┐
                  ▼                ▼                ▼
         ┌────────────┐   ┌────────────┐   ┌──────────────┐
         │  Realtime   │   │  Workers    │   │ Function     │
         │  (Bun+WS)   │   │  (3 types)  │   │ Runner(DinD) │
         │  pg_notify  │   │  Webhook    │   │ Bun runtime  │
         │  Valkey PS  │   │  Scheduler  │   │ Sandboxed    │
         └──────┬─────┘   │  Audit      │   └──────┬───────┘
                │          └──────┬──────┘          │
                │                 │                 │
                └─────────────────┼─────────────────┘
                                  │
                         ┌────────▼────────┐
                         │  PostgreSQL 16   │
                         │  + RLS + pgmq   │
                         │  + pg_notify    │
                         └────────┬────────┘
                                  │
                         ┌────────▼────────┐
                         │  RustFS (S3)    │
                         │  File Storage   │
                         └────────────────-┘
```

### Container Topology

```
┌─────────────────────────────────────────────────────────────┐
│                    Monitoring Stack                          │
│  ┌───────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Prometheus│  │  Grafana  │  │ PgExporter│  │ VkExporter│ │
│  └───────────┘  └───────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Authentication Flow

```
Client                  Gateway               Keycloak              Database
  │                       │                     │                    │
  │  POST /auth/login     │                     │                    │
  │──────────────────────►│  Forward to KC      │                    │
  │                       │────────────────────►│                    │
  │                       │  Token (JWT)        │                    │
  │                       │◄────────────────────│                    │
  │  Access Token ◄───────│                     │                    │
  │                       │                     │                    │
  │  API Request          │                     │                    │
  │  (Bearer token)──────►│                     │                    │
  │                       │  Verify JWT (JWKS)  │                    │
  │                       │────────────────────►│                    │
  │                       │  JWKS response      │                    │
  │                       │◄────────────────────│                    │
  │                       │                     │                    │
  │                       │  SET LOCAL session  │                    │
  │                       │─────────────────────────────────────────►│
  │                       │  Route to service   │                    │
  │                       │     ...             │                    │
  │  Response ◄───────────│                     │                    │
```

### Realtime Subscription Flow

```
Client WebSocket          Realtime              Postgres            Valkey
     │                       │                     │                  │
     │  WS Connect           │                     │                  │
     │  (JWT in query)──────►│                     │                  │
     │                       │  Verify JWT         │                  │
     │                       │────────────────────►│                  │
     │                       │◄────────────────────│                  │
     │                       │                     │                  │
     │  Subscribe channel    │                     │                  │
     │──────────────────────►│  LISTEN pg_notify   │                  │
     │                       │────────────────────►│                  │
     │                       │                     │                  │
     │                       │  PUBLISH to Valkey  │                  │
     │                       │────────────────────────────────────────►│
     │                       │                     │                  │
     │                       │  ── data changes ──►│                  │
     │                       │◄────────────────────│                  │
     │                       │  SUB to Valkey      │                  │
     │                       │◄────────────────────────────────────────│
     │  Push data ◄──────────│                     │                  │
```

### Webhook Delivery Flow

```
Gateway                  Worker-Webhook          Postgres          External
  │                           │                     │                │
  │  Create subscription      │                     │                │
  │───────────────────────────│────────────────────►│                │
  │                           │                     │                │
  │  ── DB event happens ─────│────────────────────►│                │
  │                           │  Poll pgmq/SKIP LOCKED               │
  │                           │────────────────────►│                │
  │                           │  Pending delivery   │                │
  │                           │◄────────────────────│                │
  │                           │                     │                │
  │                           │  POST /webhook      │                │
  │                           │  (HMAC-SHA256)──────────────────────►│
  │                           │                     │  ACK/retry     │
  │                           │◄────────────────────────────────────│
  │                           │                     │                │
  │                           │  Mark delivered     │                │
  │                           │────────────────────►│                │
```

---

## Security Model

### Multi-Tenancy via RLS

Forge uses PostgreSQL Row-Level Security for tenant isolation:

```sql
-- Each request sets session variables
SET LOCAL app.current_user_id = 'user-uuid';
SET LOCAL app.current_roles = '{admin}';
SET LOCAL app.current_tenant_id = 'tenant-uuid';

-- RLS policy example
CREATE POLICY tenant_isolation ON forge.users
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### JWT Verification

1. Gateway fetches JWKS from Keycloak on startup (cached 15 min)
2. Every request verifies the Bearer token using `jose`
3. Extracted claims (tenant_id, roles, plan) are set as Postgres session vars
4. All downstream queries are protected by RLS

### Admin Routes

Admin endpoints use a separate `X-Admin-Token` header for service-to-service auth, verified by the gateway.

### Webhook Security

Outgoing webhooks are signed with HMAC-SHA256 using a per-subscription secret, so consumers can verify authenticity.

### Function Isolation

Serverless functions run in a Docker-in-Docker sandbox with:
- Scoped JWT (limited to specific tables/buckets)
- Configurable memory and CPU limits
- Timeout enforcement

---

## Service Responsibilities

### Gateway
- **Auth**: JWT verification, admin token check
- **Routing**: Proxy to backend services
- **Rate limiting**: In-memory token bucket
- **CORS**: Configurable origins
- **Logging**: Structured JSON with correlation IDs
- **Metrics**: Prometheus `/metrics` endpoint
- **Error tracking**: Batch errors to webhook

### Realtime
- **WebSocket**: Persistent connections with JWT auth
- **pg_notify**: LISTEN for database changes
- **Valkey**: Pub/sub for multi-instance fan-out
- **Filtering**: Per-client table/row filters

### Workers
| Worker | Function |
|---|---|
| **Webhook** | Poll pending deliveries, POST with retry & backoff |
| **Scheduler** | Parse cron expressions, trigger functions |
| **Audit** | Write audit events from pgmq to audit_logs |

### Function Runner
- **DinD**: Docker-in-Docker for sandboxed execution
- **Warm pool**: Keep frequently-used functions loaded
- **Logs**: Capture stdout/stderr to database
- **Limits**: Timeout, memory, CPU per function

---

## Sequence Diagrams

### API Request Lifecycle

```
┌──────┐   ┌─────────┐   ┌──────────┐   ┌──────────┐
│Client│   │ Gateway │   │PostgreSQL│   │ Keycloak │
└──┬───┘   └────┬────┘   └────┬─────┘   └────┬─────┘
   │            │              │              │
   │  Request   │              │              │
   │───────────►│              │              │
   │            │  Fetch JWKS  │              │
   │            │──────────────│─────────────►│
   │            │◄─────────────│──────────────│
   │            │              │              │
   │            │  Verify JWT  │              │
   │            │──────────────│─────────────►│
   │            │◄─────────────│──────────────│
   │            │              │              │
   │            │  SET LOCAL   │              │
   │            │─────────────►│              │
   │            │              │              │
   │            │  Execute     │              │
   │            │─────────────►│              │
   │◄───────────│◄─────────────│              │
   │ Response   │              │              │
```

---

## Scaling Patterns

### Horizontal Scaling

| Service | Strategy | Notes |
|---|---|---|
| Gateway | Stateless, scale behind LB | No session affinity needed |
| Realtime | Multi-instance via Valkey pub/sub | Valkey distributes events |
| Workers | Multiple replicas | pgmq `SKIP LOCKED` prevents duplicates |
| Function Runner | Warm pool per instance | Each instance has independent pool |
| Postgres | Read replicas + connection pooling | Use PgBouncer for connection mgmt |
| RustFS | Distributed mode | Built-in S3 replication |

### Performance Considerations

- **Connection pooling**: Use PgBouncer between services and Postgres
- **Caching**: Valkey for session cache, JWKS cache (15-min TTL)
- **Rate limiting**: Configurable per-tenant in future
- **Webhook queue**: pgmq handles high-throughput queuing

---

## Next Steps

- See the [Deployment Guide](../deployment/README.md) for production setup
- See the [API Reference](../api/README.md) for endpoint documentation
- Check [example apps](../../examples/) for integration patterns
