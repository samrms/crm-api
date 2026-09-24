# Architecture overview

A modular monolith: one deployable process, one database, clear module
boundaries enforced by directory layout rather than by network calls. It is
built to be split later, but nothing depends on that split today.

## The shape of a request

```
HTTP request
  └─ Fastify (helmet → CORS → rate limit → cookies)
       └─ OpenAPI + Swagger UI            (static document, /docs)
       └─ request-id hooks                 (inbound X-Request-Id, outbound echo)
       └─ error handler                    (one error envelope for everything)
       └─ health routes                    (/, /health, /ready, /metrics)
       └─ Container.registerRoutes()       (all module routes, wired once)
            └─ per route: authenticate → requireRole → zod validation → service → repository
```

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| HTTP | `src/modules/*/http/*Routes.ts` | routing, auth pre-handlers, zod parsing, response shaping |
| Application | `src/modules/*/application/` | business rules, state transitions, error mapping |
| Domain | `src/modules/*/domain/` | pure state machines (`LeadState`, `DealState`) |
| Infrastructure | `src/modules/*/infrastructure/` | Kysely repositories, always tenant-scoped |
| Shared | `src/shared/` | config, database, auth, cache, http plugins, utils |
| Composition | `src/container.ts` | the only place that instantiates services and routes |

Dependencies point inward: HTTP knows services, services know repositories,
repositories know SQL. A repository never imports a service; a service never
imports Fastify.

## Modules

| Module | Owns | Routes |
| --- | --- | --- |
| `users` | registration, login, sessions, memberships | `/api/v1/auth/*` |
| `crm/companies` | customer companies | `/api/v1/companies` |
| `crm/contacts` | people at companies | `/api/v1/contacts` |
| `crm/leads` | lead pipeline, conversion | `/api/v1/leads` |
| `crm/deals` | deal pipeline | `/api/v1/deals` |
| `bulk/imports` | CSV import jobs (accepted, not processed) | `/api/v1/imports` |
| `bulk/exports` | CSV export jobs (accepted, not processed) | `/api/v1/exports` |

## Runtime

- **Server:** Bun (`bun run dev`, `bun run start`), Fastify, one process.
- **Database:** PostgreSQL via Kysely, or in-memory SQLite for development —
  selected by `DATABASE_URL`. See [ADR 001](../adr/001-database-per-environment.md).
- **Redis:** ioredis client for caching and the readiness probe. The BullMQ
  queue was removed; see [ADR 004](../adr/004-retired-async-pipeline.md).
- **Tests:** vitest under Node, reusing the production SQLite adapter.

## Tenancy

Every table that holds tenant data carries `organization_id`, and every query
goes through a repository method that takes `organizationId`. The organization
comes from the session, never from the request body, so there is no code path
where a client chooses its tenant. Deletes are soft (`deleted_at`), and every
read filters on `deleted_at IS NULL`.

## Where to read next

- [Module layout](./module-layout.md) — the directory map and import rules
- [Data model](./data-model.md) — tables, keys, and the relationships that matter
- [Request lifecycle](./request-lifecycle.md) — plugins, auth, and error handling in order
