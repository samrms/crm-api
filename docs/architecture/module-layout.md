# Module layout

## Shape

```
src/
├── server.ts                  entrypoint: migrate, build, listen, graceful shutdown
├── app.ts                     Application: plugins and wiring
├── container.ts               the only place services and routes are constructed
├── modules/
│   ├── users/                 auth service, repositories, routes
│   ├── crm/
│   │   ├── companies/         application | domain | infrastructure | http
│   │   ├── contacts/
│   │   ├── leads/             includes ConvertLead and LeadState
│   │   └── deals/             includes DealState
│   └── bulk/
│       ├── imports/           job creation + status
│       └── exports/           job creation + status
└── shared/
    ├── config.ts              Config class, reads env once
    ├── logging/logger.ts      pino instance
    ├── database/              connection, migrations, sqlite adapter, types
    ├── auth/                  AuthGuard, Authorizer, SessionManager, password hashing
    ├── cache/redis.ts         RedisClient
    ├── http/                  requestId, errorHandler, health, openapi/
    ├── pagination/            signed cursor codec
    ├── errors/AppError.ts     AppError hierarchy
    └── utils/                 id, slug, csv, token
```

## Import rules

- `modules/*/http` may import application services and shared auth.
- `modules/*/application` may import domain, repositories, and shared utils.
- `modules/*/infrastructure` may import `shared/database` and its own module.
- `shared/*` may not import from `modules/*`.
- Only `container.ts` imports every module.

These are conventions enforced by review, not by tooling: TypeScript cannot
express "no cycles across layers", and the codebase stays small enough for the
boundary to stay visible.

## Dependency injection

The container constructs each repository once with the Kysely instance, then
each service with its repository, then each route class with its service:

```ts
this.companyService = new CompanyService(new PostgresCompanyRepository(db))
await new CompanyRoutes(this.companyService).register(app)
```

No service reaches for a global database handle; every dependency is a
constructor argument. `DatabaseManager` (`shared/database/connection.ts`) is
the single place that owns the Kysely instance and decides which dialect to
build.

## Adding a module

1. `mkdir -p src/modules/<area>/<entity>/{application,domain,infrastructure,http}`
2. Repository interface + Kysely implementation, every method taking `organizationId`.
3. Service with the business rules, throwing `AppError` subclasses.
4. Route class: `authenticate`, then `requireRole` for writes, then zod parse.
5. Register the repository, service, and route in `container.ts`.
6. Add the path to `src/shared/http/openapi/paths.ts` and any new schema to `schemas.ts`.
7. Add a migration — append only, see [ADR 005](../adr/005-migration-immutability.md).

## What is intentionally absent

- No `shared/queue/`, no worker entrypoint, no `processImport`/`processExport`:
  see [ADR 004](../adr/004-retired-async-pipeline.md).
- No ORM, no DI container framework, no global mutable service registry.
- No `tasks` or `activities` API surface. The tables still exist and the demo
  seeder populates them, but no endpoint exposes them.
