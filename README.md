# CRM API

A multi-tenant CRM REST API built with **Bun, Fastify, TypeScript, PostgreSQL and Redis**. A portfolio
project focused on backend engineering quality: explicit domain state machines, strict multi-tenancy,
optimistic concurrency, a transactional outbox, and a hermetic test suite that runs without any
external services.

## Highlights

- **Modular monolith** — 7 feature modules, each with `domain / application / infrastructure / http`
  layers and its own path alias
- **Explicit state machines** — leads and deals only move through declared transitions; anything else
  is rejected (422) or conflicts (409)
- **Multi-tenancy** — every query is scoped to the caller's organization; cross-tenant reads return
  `404`, verified by dedicated security tests
- **RBAC** — `OWNER` / `ADMIN` / `MEMBER`; reads require membership, writes require `OWNER` or `ADMIN`
- **Optimistic concurrency** — versioned rows; stale writes surface as `409 OPTIMISTIC_LOCK_CONFLICT`
- **Transactional outbox** — domain side effects (audit entries, outbox events) commit atomically
  with the change that caused them
- **Keyset cursor pagination + HATEOAS** — stable `created_at DESC, id DESC` cursors, state-aware
  `_links` that only advertise legal next actions
- **Hermetic tests** — 206 tests across 6 suites (unit, integration, API, E2E, security,
  concurrency) that run on an in-memory SQLite harness — no Docker required
- **Production shape** — multi-stage Docker build, non-root container, Bun-native GitHub Actions CI

## Tech Stack

| Layer      | Choice                                            |
| ---------- | ------------------------------------------------- |
| Runtime    | Bun ≥ 1.1 (developed on 1.3)                      |
| Language   | TypeScript 5.7, `strict` + `noUncheckedIndexedAccess` |
| HTTP       | Fastify 5 (Helmet, CORS, cookie, rate-limit)      |
| Validation | Zod 3                                             |
| Database   | PostgreSQL 16 via Kysely 0.27 (type-safe SQL)     |
| Queue      | Redis 7 + BullMQ 5 (separate worker process)      |
| Logging    | Pino (JSON, request-scoped)                       |
| Tests      | Vitest 3 (Node ≥ 22.5 for `node:sqlite`)          |
| Quality    | ESLint 9 (flat config), Prettier 3, `tsc --noEmit` |
| Shipping   | Docker multi-stage, GitHub Actions                |
| API Docs   | OpenAPI 3 + Swagger UI at `/docs` (schemas from Zod) |

## Architecture

```
        ┌──────────────┐        ┌──────────────┐
        │   REST API   │        │    Worker    │
        │  (Fastify)   │        │   (BullMQ)   │
        └──────┬───────┘        └──────┬───────┘
               │  Kysely               │  Kysely
        ┌──────┴───────────────────────┴───────┐
        │            PostgreSQL               │
        │  domain rows │ outbox │ audit log    │
        └──────────────────────────────────────┘
               ▲
               │  outbox events (written in the same transaction)
        Redis ─┴─ BullMQ queue `crm-jobs`
```

The API and the worker are separate entrypoints (`src/server.ts`, `src/worker.ts`) sharing one
codebase. The server runs migrations on boot, then listens; the worker consumes `process-import`
and `process-export` jobs with idempotency guards (a completed job is never re-applied) and
`PENDING → PROCESSING → COMPLETED | FAILED` status transitions. Dispatching outbox rows onto the
queue is intentionally left as an integration point — the outbox table is the durable,
at-least-once source of truth.

### Module anatomy

Every feature module under `src/modules/` follows the same shape:

```
src/modules/<module>/
├── domain/          # state machines, invariants — pure functions, zero I/O
├── application/     # use cases and services (transactions live here)
├── infrastructure/  # Kysely repositories (tenant scoping, keyset queries)
└── http/            # Fastify routes: Zod parse → service → response envelope
```

Shared building blocks live in `src/shared/` (auth, config, database, errors, http, logging,
pagination, utils).

### Path aliases

Imports never climb with `../../..` — each module has an alias (declared once in `tsconfig.json`,
resolved by Bun at runtime and `tsc` at compile time):

Two aliases cover every import (declared once in `tsconfig.json` and `vitest.config.ts`,
resolved by Bun at runtime and `tsc` at compile time):

| Alias         | Maps to        |
| ------------- | -------------- |
| `@/*`         | `src/*`        |
| `@shared/*`   | `src/shared/*` |

## Domain Model

**Tenancy** — `organization` owns everything; `user` + `membership(role)` grant access. Sessions are
server-side rows tied to one organization, revocable, with enforced expiry.

**CRM core** — `company` → `contact` and `company` → `deal`; `lead` is a pipeline record that can be
converted into a company + contact + deal in one transaction.

### Lead state machine

```
NEW ──► CONTACTED ──► QUALIFIED ──► CONVERTED (terminal)
  │          │            │
  └──────────┴────────────┴──────► DISQUALIFIED (terminal)
```

`POST /leads/:id/qualify` walks the shortest legal path (BFS over the transition graph);
`POST /leads/:id/convert` is terminal and guarded by an optimistic-lock check.

### Deal state machine

```
NEW ──► QUALIFIED ──► PROPOSAL ──► NEGOTIATION ──► WON (terminal)
                                             └──► LOST (terminal)
```

`POST /deals/:id/advance` moves one step (same-stage advance → `409 CONFLICT`), while `win` and
`lose` jump from `NEGOTIATION` to a terminal stage.

### Lead conversion (the critical operation)

One transaction does all of it, or none of it:

1. Find-or-create `company` (by name, tenant-scoped) and `contact` (by lead email)
2. Create the `deal` linked to company/contact/lead
3. Flip the lead to `CONVERTED` with a version bump (stale version → `409`)
4. Insert an `audit_events` row (who converted what) and an `outbox_events` row

## API

Base path `/api/v1`, JSON in / JSON out, session cookie auth.
Interactive docs at `/docs` (Swagger UI); raw OpenAPI 3 document at `/docs/json`.
Request schemas in the document are generated from the same Zod schemas that validate requests.

### Endpoints

| Method | Path                          | Access       |
| ------ | ----------------------------- | ------------ |
| GET    | `/health`                     | public (liveness) |
| GET    | `/ready`                      | public (Postgres + Redis readiness, `200`/`503`) |
| POST   | `/api/v1/auth/register`       | public — creates org + owner + session |
| POST   | `/api/v1/auth/login`          | public       |
| POST   | `/api/v1/auth/logout`         | authenticated |
| GET    | `/api/v1/auth/me`             | authenticated |
| GET    | `/api/v1/companies`, `/companies/:id` | authenticated |
| POST   | `/api/v1/companies`           | OWNER/ADMIN  |
| PATCH  | `/api/v1/companies/:id`       | OWNER/ADMIN  |
| DELETE | `/api/v1/companies/:id`       | OWNER/ADMIN  |
| GET    | `/api/v1/contacts`, `/contacts/:id` | authenticated |
| POST/PATCH/DELETE | `/api/v1/contacts…`   | OWNER/ADMIN  |
| GET    | `/api/v1/leads`, `/leads/:id` | authenticated |
| POST/PATCH/DELETE | `/api/v1/leads…`       | OWNER/ADMIN  |
| POST   | `/api/v1/leads/:id/qualify`   | OWNER/ADMIN  |
| POST   | `/api/v1/leads/:id/convert`   | OWNER/ADMIN  |
| GET    | `/api/v1/deals`, `/deals/:id` | authenticated |
| POST/PATCH/DELETE | `/api/v1/deals…`       | OWNER/ADMIN  |
| POST   | `/api/v1/deals/:id/advance`   | OWNER/ADMIN  |
| POST   | `/api/v1/deals/:id/win` / `lose` | OWNER/ADMIN |
| GET    | `/api/v1/tasks`, `/tasks/:id` | authenticated |
| POST/PATCH/DELETE, `/tasks/:id/complete` | OWNER/ADMIN |
| GET/POST/PATCH/DELETE | `/api/v1/members…` | OWNER/ADMIN |
| GET    | `/api/v1/organizations/:id`   | authenticated |
| PATCH  | `/api/v1/organizations/:id`   | OWNER/ADMIN  |
| POST   | `/api/v1/imports`             | OWNER/ADMIN  |
| GET    | `/api/v1/imports/:id`         | authenticated |
| POST   | `/api/v1/exports`             | OWNER/ADMIN  |
| GET    | `/api/v1/exports/:id`         | authenticated |
| GET    | `/api/v1/audit-events`, `/:id`| OWNER/ADMIN  |

### Error contract

Every failure has the same shape — machine-readable `code`, human `message`, and the `requestId`
that ties it to the logs (500s never leak stack traces):

```json
{
  "error": {
    "code": "OPTIMISTIC_LOCK_CONFLICT",
    "message": "Deal was modified by another request",
    "requestId": "req-1f2e3d"
  }
}
```

| Status | Codes                                                  |
| ------ | ------------------------------------------------------ |
| 400    | `INVALID_CURSOR`                                       |
| 401    | `UNAUTHORIZED` (missing/expired/revoked session)        |
| 403    | `FORBIDDEN` (role too low)                             |
| 404    | `NOT_FOUND` (also used for cross-tenant IDs)           |
| 409    | `CONFLICT`, `OPTIMISTIC_LOCK_CONFLICT`                 |
| 422    | `VALIDATION_ERROR` (Zod failures and illegal transitions, with `details`) |
| 429    | `RATE_LIMITED`                                         |
| 500    | `INTERNAL_ERROR`                                       |

### Pagination

Keyset (not offset) pagination on `created_at DESC, id DESC` with a base64url cursor — stable under
inserts, no duplicated or skipped rows:

```http
GET /api/v1/companies?limit=25
GET /api/v1/companies?limit=25&after=<nextCursor>

{
  "data": [ ... ],
  "pagination": { "limit": 25, "hasNextPage": true, "nextCursor": "eyJjcmVhdGVkQXQiOi…" }
}
```

`limit` is capped at 100; a malformed cursor is `400 INVALID_CURSOR`. The companies list also
demonstrates a tenant-scoped filter (`?name=`, exact match, parameterized).

### HATEOAS

Responses advertise only the actions that are legal *right now*:

```json
{
  "data": {
    "id": "ld_Kx9…",
    "status": "QUALIFIED",
    "_links": {
      "self":    { "href": "/api/v1/leads/ld_Kx9…" },
      "qualify": { "href": "/api/v1/leads/ld_Kx9…/qualify" },
      "convert": { "href": "/api/v1/leads/ld_Kx9…/convert" }
    }
  }
}
```

A `CONVERTED` lead advertises neither action; a `NEGOTIATION` deal advertises `win`/`lose` but not
`advance` once terminal.

## Security

- **Passwords**: argon2id; sessions are opaque server-side tokens in an `HttpOnly` cookie with
  expiry and revocation (logout invalidates immediately)
- **Tenant isolation**: organization scoping is enforced in the repository layer, not in handlers —
  covered by IDOR/tenant-escape tests
- **Mass assignment**: request bodies pass through Zod schemas that strip unknown keys
  (`role`, `deletedAt`, `organization_id` cannot be smuggled in)
- **SQL injection**: only parameterized Kysely queries; cursor and filter inputs are validated
- **CSV**: exported/imported values are guarded against formula injection (`=`, `+`, `-`, `@`
  prefixes neutralized); quoted cells round-trip correctly
- **Rate limiting**: per-IP (default 100/min → `429 RATE_LIMITED`); explicitly disabled under
  `NODE_ENV=test` except in the test that exercises it
- **Headers/hardening**: Helmet, strict CORS origin, generic 500s, request IDs on every response

## Testing

Tests are **hermetic by design**: each test file boots its own in-memory SQLite database through a
thin harness (`tests/fixtures/testDatabase.ts`) that emulates the PostgreSQL semantics the code
relies on — date strings revive to `Date` on read, and objects serialize to JSON on bind the same
way `pg` does. No containers, no network, no shared state between files.

| Suite         | Command                | Files | Tests | What it proves                                |
| ------------- | ---------------------- | ----: | ----: | --------------------------------------------- |
| unit          | `bun run test:unit`    |    25 |   107 | services, state machines, utils, pure logic   |
| integration   | `bun run test:integration` |  5 |    33 | repositories, tenant isolation, outbox writes |
| api           | `bun run test:api`     |     1 |    34 | contracts, errors, pagination, HATEOAS, RBAC  |
| e2e           | `bun run test:e2e`     |     1 |     5 | full workflows: register → convert → win      |
| security      | `bun run test:security`|     1 |    21 | IDOR, auth bypass, mass assignment, CSV, rate limit |
| concurrency   | `bun run test:concurrency` | 1 |     6 | optimistic locking, idempotent duplicate jobs |
| **total**     | `bun run test`         |    34 |   206 |                                               |

## Getting Started

**Prerequisites**: [Bun](https://bun.sh) ≥ 1.1, Node.js ≥ 22.5 (the test runner uses `node:sqlite`),
Docker (for Postgres/Redis).

```bash
bun install                     # install dependencies
cp .env.example .env            # configure the environment

docker compose up -d postgres   # local PostgreSQL
bun run migrate                 # apply the 14 migrations

bun run dev                     # API on http://localhost:3000
bun run dev:worker              # optional: background worker
```

```bash
bun run test                    # full suite — no services needed
bun run lint && bun run typecheck && bun run format:check
```

Register and go:

```bash
curl -s -X POST localhost:3000/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"owner@acme.test","password":"secret1234","name":"Owner","organizationName":"Acme"}'
# → 201 + Set-Cookie: session=…; HttpOnly
```

## Scripts

| Script                 | Purpose                                   |
| ---------------------- | ----------------------------------------- |
| `dev` / `dev:worker`   | run API / worker with watch reload        |
| `build` / `start`      | compile with `tsc` → `dist/`, run it      |
| `start:worker`         | run the compiled worker                   |
| `test` (+ `test:unit`, `test:integration`, `test:api`, `test:e2e`, `test:security`, `test:concurrency`) | run suites |
| `test:watch` / `test:coverage` | watch mode / V8 coverage report     |
| `lint` / `lint:fix`    | ESLint over `src/` and `tests/`           |
| `format` / `format:check` | Prettier write / verify                |
| `typecheck`            | `tsc --noEmit`                            |
| `migrate` / `migrate:rollback` / `db:reset` | schema up / down / rebuild  |

## Docker

Multi-stage build (`deps → build → production`): frozen lockfile install, in-container typecheck
and compile, then a slim runtime on the official `oven/bun:1` image running as a **non-root** user. `tsconfig.json`
ships in the final image so Bun resolves the `@/…` path aliases at runtime; `.dockerignore` keeps
`.env`, `node_modules` and tests out of the context.

```bash
docker build -t crm-api .                       # image only
docker compose up --build                       # postgres + redis + api + worker
```

Host ports are overridable (defaults `3000/5432/6379`):

```bash
API_PORT=13000 REDIS_PORT=16379 docker compose up --build
```

The API container runs migrations on boot; `/ready` reports `200` once Postgres and Redis both
answer.

## CI

`.github/workflows/ci.yml` (Bun-native, no external services):

1. **quality** — `bun install --frozen-lockfile`, `lint`, `typecheck`, `format:check`
2. **tests** — the full 206-test suite
3. **build** — `tsc` compile + `docker build` (gated on the previous two)

## Project Structure

```
src/
├── server.ts                 # API entrypoint (migrate → listen → graceful shutdown)
├── worker.ts                 # BullMQ worker entrypoint (crm-jobs)
├── app.ts                    # Fastify wiring: plugins, error handler, module routes
├── modules/
│   ├── users/                # auth routes (register/login/logout/me)
│   ├── organizations/        # orgs + members (RBAC) + audit trail reads
│   ├── crm/                  # companies, contacts, leads (+LeadState, ConvertLead), deals (+DealState)
│   ├── engagement/           # tasks
│   └── bulk/                 # async import/export jobs
└── shared/
    ├── auth/                 # password hashing, sessions, authenticate, requireRole
    ├── cache/redis.ts
    ├── config.ts             # typed env access with defaults
    ├── database/             # connection, migrations (14), Kysely types
    ├── errors/AppError.ts    # error taxonomy → HTTP status/code mapping
    ├── http/                 # errorHandler, health, requestId
    ├── logging/logger.ts     # Pino
    ├── pagination/           # cursor encode/decode/verify
    └── utils/                # slug, id, result, csv, date, validate
tests/
├── fixtures/                 # factories + in-memory SQLite harness
├── unit/ integration/ api/ e2e/ security/ concurrency/
.github/workflows/ci.yml
Dockerfile · docker-compose.yml · .dockerignore
```
