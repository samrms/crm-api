# ADR 001: One database layer, two drivers, selected by DATABASE_URL

- **Status:** Accepted
- **Date:** 2026-09-23

## Context

The API is a multi-tenant CRM. It must run against PostgreSQL in production
where data must persist, but a developer cloning the repo should be able to
`bun run dev` and have a working API without Docker, without installing
Postgres, and without losing a day to connection setup.

Two runtimes also matter: the server runs on **Bun** (`bun run dev`,
`docker/Dockerfile`), while the test suite runs under **Node** via vitest.
Node ships `node:sqlite`; Bun does not — Bun ships `bun:sqlite` and its
`node:sqlite` polyfill does not exist. Whichever adapter we pick must work
under both.

## Decision

`src/shared/database/sqlite.ts` and `src/shared/database/connection.ts` select
the dialect from the `DATABASE_URL` string:

| `DATABASE_URL` | Dialect | Notes |
| --- | --- | --- |
| `sqlite://`, `:memory:`, `*.db`, `*.sqlite` | Kysely `SqliteDialect` | In-memory by default; a path gives a file |
| anything else (e.g. `postgres://…`) | Kysely `PostgresDialect` | Production path |

The SQLite engine is loaded at runtime: `node:sqlite` is tried first, and
`bun:sqlite` is the fallback. Kysely's `SqliteDatabase` contract is tiny
(`prepare`, `close`), so a ~120-line wrapper (`src/shared/database/sqlite.ts`)
covers the whole integration, including the two real differences:

- **Date handling.** Columns are `text`, but the Kysely types declare `Date`.
  Values are serialized to ISO-8601 on write and revived to `Date` on read, so
  `expires_at > now` comparisons behave the same in both drivers.
- **Parameter coercion.** `Date` → ISO string, booleans → `0/1`, plain
  objects → JSON, `undefined` → `null`, which is what both engines can bind.

`getPool()` throws when the URL is SQLite, because there is no pool. `/ready`
uses `select 1` through Kysely instead of a raw pool so it is driver-agnostic.

## Consequences

- Zero-dependency onboarding: `cp .env.example .env && bun run dev`.
- The test suite reuses the production adapter (`tests/fixtures/testDatabase.ts`)
  instead of a second SQLite wrapper, so tests exercise the same code path.
- **SQLite does not enforce foreign keys by default.** Bun's driver leaves FKs
  off, Node's `node:sqlite` enforces them. This difference is not theoretical:
  a missing parent row passed in Bun dev and failed under Node and PostgreSQL.
  Referential integrity is therefore tested against PostgreSQL or Node, never
  assumed from a Bun dev boot.
- Production remains PostgreSQL-only. The `docker` and `render` blueprints both
  inject a `postgres://` URL.
