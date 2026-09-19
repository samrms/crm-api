# CRM API — Minimal Strong REST API

A carefully engineered CRM REST API demonstrating backend architecture, TypeScript, domain modeling, PostgreSQL, Redis, BullMQ, and modern engineering practices.

## Project Purpose

This is a **greenfield portfolio project** — minimal in product scope but strong in engineering quality. It demonstrates:

- Backend architecture (modular monolith + separate worker)
- Domain-driven design with explicit state machines
- Type-safe database access (Kysely)
- Multi-tenancy with tenant isolation at every layer
- Secure authentication (Argon2id, cookie sessions, revocation)
- RBAC (OWNER/ADMIN/MEMBER)
- Optimistic concurrency control
- Transactional outbox pattern for reliable async processing
- BullMQ worker with exponential backoff retry
- Idempotent job processing
- Cursor pagination with signed cursors
- HATEOAS links
- OpenAPI documentation
- Comprehensive testing (unit, integration, API, E2E, security)
- Structured logging, metrics, health checks
- Docker, CI/CD, Render deployment

## Architecture

```
                    ┌─────────────────┐
                    │    REST API     │
                    │    Fastify      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Application     │
                    │ Use Cases       │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Domain          │
                    │ Business Rules  │
                    └────────┬────────┘
                             │
             ┌───────────────┼────────────────┐
             ▼               ▼                ▼
       PostgreSQL          Redis             AI
             │               │
             ▼               ▼
          Outbox          BullMQ
                             │
                             ▼
                           Worker
```

## Domain Model

```
Organization
    │
    ├── Users / Members (RBAC: OWNER | ADMIN | MEMBER)
    │
    ├── Companies
    │      │
    │      └── Contacts
    │
    ├── Leads
    │      │
    │      └── Conversion (atomic transaction)
    │              │
    │              └── Deal
    │
    ├── Activities
    ├── Tasks
    │
    ├── Imports
    ├── Exports
    └── Audit
```

### Lead State Machine

```
NEW
  ↓
CONTACTED
  ↓
QUALIFIED
  ↓
CONVERTED          ←── Atomic: creates Company + Contact + Deal + Audit + Outbox
                  ↑
DISQUALIFIED (terminal)
```

### Deal State Machine

```
NEW
  ↓
QUALIFIED
  ↓
PROPOSAL
  ↓
NEGOTIATION
  ├──→ WON (terminal)
  └──→ LOST (terminal)
```

## Business Rules

### Lead Transitions

| From         | Valid To                |
| ------------ | ----------------------- |
| NEW          | CONTACTED, DISQUALIFIED |
| CONTACTED    | QUALIFIED, DISQUALIFIED |
| QUALIFIED    | CONVERTED, DISQUALIFIED |
| CONVERTED    | (none — terminal)       |
| DISQUALIFIED | (none — terminal)       |

### Deal Transitions

| From        | Valid To          |
| ----------- | ----------------- |
| NEW         | QUALIFIED         |
| QUALIFIED   | PROPOSAL          |
| PROPOSAL    | NEGOTIATION       |
| NEGOTIATION | WON, LOST         |
| WON         | (none — terminal) |
| LOST        | (none — terminal) |

### Lead Conversion (Critical Operation)

Within a single PostgreSQL transaction:

1. Validate lead can be converted (status = QUALIFIED)
2. Find or create Company (by name/domain)
3. Find or create Contact (by email within company)
4. Create Deal (linked to company, contact, lead)
5. Update Lead status → CONVERTED, link to deal
6. Create Audit record
7. Create Outbox event

On failure: **ROLLBACK**. No partial state.

## Security

### Defense in Depth

```
Request
  ↓
Request ID
  ↓
Rate limiting (100 req/min)
  ↓
Authentication (session cookie)
  ↓
Organization context (from session)
  ↓
Authorization (RBAC)
  ↓
Validation (Zod schemas)
  ↓
Application use case
  ↓
Tenant-scoped repository
  ↓
Database constraints (FK, unique, check)
```

### Protections Implemented

- **IDOR**: Every query scoped by `organization_id`
- **Tenant escape**: Middleware enforces `request.organizationId`
- **Mass assignment**: Explicit field allow-lists in use cases
- **SQL injection**: Kysely parameterized queries
- **Auth bypass**: Session validation on every request
- **Authz bypass**: Role checks on sensitive operations
- **Privilege escalation**: OWNER-only for membership changes
- **Rate-limit bypass**: Per-IP + per-user limits
- **Malicious CSV**: File size limits, sanitization
- **Sensitive error leakage**: Generic 500 messages, requestId for debugging

### Authentication

- **Passwords**: Argon2id (memory: 64MB, time: 3, parallelism: 4)
- **Sessions**: httpOnly secure cookies, 30-day expiry, DB-backed with revocation
- **Logout**: Immediate revocation (`revoked_at`)

### Authorization

Roles: `OWNER` > `ADMIN` > `MEMBER`

| Operation               | Required Role            |
| ----------------------- | ------------------------ |
| Create organization     | OWNER (via registration) |
| Add/remove members      | OWNER                    |
| Change member role      | OWNER                    |
| Create/update companies | MEMBER+                  |
| Create/update contacts  | MEMBER+                  |
| Lead conversion         | MEMBER+                  |
| Deal stage changes      | MEMBER+                  |
| Import/export           | MEMBER+                  |

## Multi-Tenancy

Every tenant-owned resource belongs to an organization. Every query includes:

```sql
WHERE organization_id = $orgId AND deleted_at IS NULL
```

**Never** query by ID alone and authorize afterward. Tenant isolation is part of repository behavior.

## API Design

### Versioning

```
/api/v1
```

### Endpoints

| Method | Path                         | Description                    |
| ------ | ---------------------------- | ------------------------------ |
| POST   | `/api/v1/auth/register`      | Register org + user + session  |
| POST   | `/api/v1/auth/login`         | Login + session                |
| POST   | `/api/v1/auth/logout`        | Revoke session                 |
| GET    | `/api/v1/auth/me`            | Current user + org             |
| GET    | `/api/v1/companies`          | List companies                 |
| POST   | `/api/v1/companies`          | Create company                 |
| GET    | `/api/v1/companies/:id`      | Get company                    |
| PATCH  | `/api/v1/companies/:id`      | Update company                 |
| GET    | `/api/v1/contacts`           | List contacts                  |
| POST   | `/api/v1/contacts`           | Create contact                 |
| GET    | `/api/v1/contacts/:id`       | Get contact                    |
| GET    | `/api/v1/leads`              | List leads                     |
| POST   | `/api/v1/leads`              | Create lead                    |
| GET    | `/api/v1/leads/:id`          | Get lead                       |
| POST   | `/api/v1/leads/:id/qualify`  | NEW → CONTACTED → QUALIFIED    |
| POST   | `/api/v1/leads/:id/convert`  | QUALIFIED → CONVERTED (atomic) |
| GET    | `/api/v1/deals`              | List deals                     |
| POST   | `/api/v1/deals`              | Create deal                    |
| GET    | `/api/v1/deals/:id`          | Get deal                       |
| POST   | `/api/v1/deals/:id/advance`  | Stage transition               |
| POST   | `/api/v1/deals/:id/win`      | NEGOTIATION → WON              |
| POST   | `/api/v1/deals/:id/lose`     | NEGOTIATION → LOST             |
| GET    | `/api/v1/tasks`              | List tasks                     |
| POST   | `/api/v1/tasks`              | Create task                    |
| POST   | `/api/v1/tasks/:id/complete` | Complete task                  |
| POST   | `/api/v1/imports`            | Create import (202)            |
| GET    | `/api/v1/imports/:id`        | Import status                  |
| POST   | `/api/v1/exports`            | Create export (202)            |
| GET    | `/api/v1/exports/:id`        | Export status + download URL   |
| GET    | `/health`                    | Process alive                  |
| GET    | `/ready`                     | Dependencies ready             |

### HTTP Semantics

| Code | Use                                   |
| ---- | ------------------------------------- |
| 201  | Created (sync)                        |
| 202  | Accepted (async)                      |
| 204  | No Content (delete/logout)            |
| 400  | Bad Request                           |
| 401  | Unauthorized                          |
| 403  | Forbidden                             |
| 404  | Not Found                             |
| 409  | Conflict (optimistic lock, duplicate) |
| 422  | Validation Error                      |
| 429  | Too Many Requests                     |
| 500  | Internal Error                        |
| 503  | Service Unavailable (not ready)       |

### Error Contract

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Deal not found",
    "requestId": "req_abc123"
  }
}
```

Validation errors include `details` with Zod issues.

### Cursor Pagination

```
GET /api/v1/deals?limit=50&after=<cursor>
```

Response:

```json
{
  "data": [...],
  "pagination": {
    "limit": 50,
    "hasNextPage": true,
    "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI0LTAxLTE1VDEwOjMwOjAwWiIsImlkIjoiZGxfYWJjMTIzIn0.sig"
  }
}
```

- Default limit: 25, max: 100
- Ordering: `created_at DESC, id DESC` (deterministic)
- Cursor = base64url({ createdAt, id }) + HMAC signature
- Tampered cursors → 400

### HATEOAS

```json
{
  "data": { "id": "dl_abc123", "stage": "NEGOTIATION", ... },
  "_links": {
    "self": { "href": "/api/v1/deals/dl_abc123" },
    "win": { "href": "/api/v1/deals/dl_abc123/win", "method": "POST" },
    "lose": { "href": "/api/v1/deals/dl_abc123/lose", "method": "POST" }
  }
}
```

Links are **state-aware** — `win`/`lose` only appear in NEGOTIATION.

> ⚠️ HATEOAS is not a security boundary. Server always enforces authorization.

### Async Operations

Imports/exports return `202 Accepted`:

```json
{
  "data": { "id": "imp_abc123", "status": "PENDING", "type": "companies" },
  "_links": {
    "self": { "href": "/api/v1/imports/imp_abc123" },
    "status": { "href": "/api/v1/imports/imp_abc123" }
  }
}
```

Poll `/api/v1/imports/:id` until `COMPLETED` or `FAILED`.

## Async Processing

### Architecture

```
HTTP API
  ↓
Durable job record (PostgreSQL)
  ↓
Outbox event (same transaction)
  ↓
Dispatcher (polling)
  ↓
BullMQ (Redis)
  ↓
Worker (separate process)
  ↓
Processing
  ↓
COMPLETED / FAILED
```

### Job States

`PENDING` → `PROCESSING` → `RETRYING` → `COMPLETED` | `FAILED` | `CANCELLED`

### Retry Strategy

- Exponential backoff: 1s, 2s, 4s...
- Jitter: ±25%
- Max attempts: 3
- Retryable: 429, 503, timeouts, temp network/DB errors
- **Not retryable**: 400, 401, 403, invalid input, business rule violations

### Idempotency

At-least-once delivery + idempotent handlers:

- Import rows: `importId + rowNumber` unique constraint
- Export: idempotent by `exportId`
- Upserts where appropriate

Duplicate execution → no duplicate business data.

### Transactional Outbox

```sql
BEGIN
  -- Business changes
  INSERT INTO outbox_events (type, payload, organization_id) VALUES (...);
COMMIT
```

Dispatcher polls unprocessed events, publishes to BullMQ, marks `processed_at`.

## Caching

Selective Redis caching:

- Organization summary (member count, deal count)
- Deal pipeline summary (counts per stage)

Pattern: read-through with invalidation on mutation. Core CRM works without Redis.

## AI Integration

Single isolated use case: **Deal Summary Generation**.

```
Application
  ↓
AI Service Interface
  ↓
OpenAI Provider (timeout, retry, cost limits)
  ↓
Structured output (JSON schema)
  ↓
Zod validation
  ↓
Business rule validation
  ↓
Persist
```

Security:

- No passwords, tokens, cross-org data sent to LLM
- Output validated before use
- Per-organization rate limiting
- Audit trail

## Testing

| Layer       | Focus                                                                         | Tools                   |
| ----------- | ----------------------------------------------------------------------------- | ----------------------- |
| Unit        | Domain rules, state machines, cursor encoding, auth policies                  | Vitest                  |
| Integration | Repositories, constraints, transactions, outbox, queue, cache                 | Vitest + testcontainers |
| API         | Auth, authz, validation, 404, 409, pagination, HATEOAS, tenant isolation      | Fastify inject          |
| E2E         | Full CRM workflow, import/export, tenant isolation                            | Vitest                  |
| Security    | IDOR, tenant escape, mass assignment, SQLi, auth bypass, privilege escalation | Vitest                  |
| Concurrency | Dual deal update (409), duplicate job, concurrent idempotent                  | Vitest                  |
| Failure     | DB down, Redis down, queue down, AI timeout/429, worker crash                 | Vitest                  |

### Test Organization

```
tests/
├── unit/
│   ├── leads/LeadState.test.ts
│   ├── deals/DealState.test.ts
│   ├── shared/CursorEncoder.test.ts
│   └── auth/PasswordHasher.test.ts
├── integration/
├── api/
├── e2e/
├── security/
├── concurrency/
└── fixtures/
```

Run: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:api`, `pnpm test:e2e`, `pnpm test:security`

## Observability

### Structured Logging (Pino)

Every request: `requestId`. Async ops: `jobId`. Relevant logs: `organizationId`, `actorId`.

Never logged: passwords, session tokens, API keys, secrets.

### Metrics (Prometheus)

- HTTP request duration
- HTTP error count
- Database latency
- Queue depth
- Job duration / success / failure / retries

### Health Checks

| Endpoint      | Purpose                      |
| ------------- | ---------------------------- |
| `GET /health` | Process alive                |
| `GET /ready`  | PostgreSQL + Redis available |

## Development

### Prerequisites

- Node.js 20+
- pnpm 10+
- Docker (for local PostgreSQL + Redis)

### Quick Start

```bash
# Install
pnpm install
pnpm approve-builds --all

# Start infrastructure
docker compose up -d

# Run migrations
pnpm migrate

# Start API
pnpm dev

# Start Worker (separate terminal)
pnpm dev:worker
```

### Commands

```bash
pnpm dev          # API with hot reload
pnpm dev:worker   # Worker with hot reload
pnpm build        # TypeScript compile
pnpm start        # Run built API
pnpm start:worker # Run built worker
pnpm test         # All tests
pnpm test:unit    # Unit tests only
pnpm test:integration
pnpm test:api
pnpm test:e2e
pnpm test:security
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm migrate      # Run migrations up
pnpm migrate:rollback # Rollback last migration
pnpm db:reset     # Rollback + migrate
```

## Deployment

### Docker

Multi-stage build:

- `deps` → install dependencies
- `build` → typecheck + compile
- `production` → minimal runtime image (non-root user)

### Render (Blueprint)

```yaml
services:
  - type: web # API
    name: crm-api
    startCommand: node dist/server.js
  - type: worker # Background worker
    name: crm-worker
    startCommand: node dist/worker.js
  - type: pserv # PostgreSQL
  - type: redis # Redis
```

Environment variables (secrets in Render dashboard):

- `DATABASE_URL`
- `REDIS_URL`
- `SESSION_SECRET`
- `AI_API_KEY` (optional)
- `CORS_ORIGIN`

### CI/CD (GitHub Actions)

```yaml
install → lint → typecheck → unit tests → integration tests → security tests → OpenAPI validation → build → Docker build → deploy
```

## Trade-offs

| Decision             | Trade-off                                           |
| -------------------- | --------------------------------------------------- |
| Modular monolith     | Simpler ops, but all modules share DB               |
| Cookie sessions      | Immediate revocation, but DB round-trip per request |
| Kysely over ORM      | Type-safe SQL, more verbose than ORM                |
| Cursor pagination    | Consistent performance, but no random page access   |
| Transactional outbox | Reliable async, but polling overhead                |
| Optimistic locking   | No lost updates, but client must handle 409         |
| BullMQ + Redis       | Mature queue, but extra infrastructure              |
| No GraphQL           | Simpler, but clients can't shape responses          |
| No event sourcing    | Simpler, but no temporal queries                    |

## Non-Goals

Intentionally **not implemented**:

- Billing / payments / subscriptions
- Inventory / products
- Invoicing
- Marketing automation
- Full calendar / chat / notifications
- Advanced analytics / BI
- Complex workflow engine
- Complex permission engine
- Multi-agent AI / autonomous agents
- Microservices / Kubernetes / Kafka / Elasticsearch / GraphQL / CQRS / Event sourcing

## Documentation

- [ADR-001: Modular Monolith](docs/adr/001-modular-monolith.md)
- [ADR-002: PostgreSQL](docs/adr/002-postgresql.md)
- [ADR-003: Authentication Strategy](docs/adr/003-authentication-strategy.md)
- [ADR-004: Cursor Pagination](docs/adr/004-cursor-pagination.md)
- [ADR-005: Queue & Worker Architecture](docs/adr/005-queue-worker-architecture.md)
- [ADR-006: Transactional Outbox](docs/adr/006-transactional-outbox.md)
- [ADR-007: Optimistic Concurrency](docs/adr/007-optimistic-concurrency.md)
- [ADR-008: AI Integration Boundary](docs/adr/008-ai-integration-boundary.md)

## License

MIT — Portfolio project for demonstration purposes.
