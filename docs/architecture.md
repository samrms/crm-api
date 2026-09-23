# Architecture

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

## Modules

7 feature modules. `domain/` exists only where state machines live; cross-cutting writes
(audit, outbox) commit in the same transaction as the change that caused them.

```
src/
├── server.ts                 # API entrypoint (migrate → listen → graceful shutdown)
├── worker.ts                 # BullMQ worker entrypoint (crm-jobs)
├── app.ts                    # Fastify wiring: plugins, error handler, module routes
├── modules/
│   ├── users/                # auth (register/login/logout/me, password reset/change)
│   ├── organizations/        # orgs + members (RBAC) + audit trail reads
│   ├── crm/                  # companies, contacts, leads (+LeadState, ConvertLead), deals (+DealState)
│   ├── engagement/           # tasks
│   └── bulk/                 # async import/export jobs
└── shared/
    ├── auth/                 # password hashing, sessions, authenticate, requireRole
    ├── cache/redis.ts        # single Redis client (BullMQ passes its own options)
    ├── config.ts             # typed env access with defaults
    ├── database/             # connection, migrations, Kysely types, outbox writer, seed
    ├── errors/AppError.ts    # error taxonomy → HTTP status/code mapping
    ├── http/                 # errorHandler, health (+ GET / landing), requestId
    ├── logging/logger.ts     # Pino
    ├── pagination/           # cursor encode/decode/verify (signed, base64url)
    └── utils/                # slug, id
```

### Module anatomy

```
src/modules/<module>/
├── domain/          # state machines, invariants — pure functions, zero I/O (leads, deals only)
├── application/     # use cases and services (transactions live here)
├── infrastructure/  # Kysely repositories (tenant scoping, keyset queries)
└── http/            # Fastify routes: Zod parse → service → response envelope
```

### Path aliases

Two aliases cover every import — no `../../..` climbs (declared once in `tsconfig.json` and
`vitest.config.ts`, resolved by Bun at runtime and `tsc` at compile time):

| Alias       | Maps to        |
| ----------- | -------------- |
| `@/*`       | `src/*`        |
| `@shared/*` | `src/shared/*` |

## Domain model

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
