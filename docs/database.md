# Database

PostgreSQL (16 in Docker, any recent version locally) accessed exclusively through
type-safe Kysely query builders — no raw SQL in application code, every value bound
as a parameter.

## Schema

| Table | Purpose |
|---|---|
| `organizations` | tenancy root; every row below is scoped to one |
| `users` | identity + argon2id `password_hash` |
| `memberships` | user ↔ org link + `role` (`OWNER`/`ADMIN`/`MEMBER`) |
| `sessions` | opaque revocable tokens with expiry |
| `password_reset_tokens` | sha256-hashed single-use tokens (1h, `used_at`) |
| `companies`, `contacts` | CRM records, soft-deletable |
| `leads` | pipeline records with `status` + optimistic-lock `version` |
| `deals` | pipeline records with `stage`, `value`, `version` |
| `activities` | timeline entries (call/email/meeting/note) linked to CRM records |
| `tasks` | work items with status, due date, assignee |
| `audit_events` | append-only trail (`actor_id`, action, resource, metadata) |
| `outbox_events` | transactional outbox (written atomically with domain changes) |
| `imports`, `exports` | async bulk-job rows with status lifecycle |
| `kysely_migrations` | Kysely bookkeeping (do not touch) |

Date columns are `text` (ISO strings) so the same migrations run on PostgreSQL and on the
SQLite test harness — see below.

## Migrations

Numbered Kysely migrations in `src/shared/database/migrations/`, registered in
`src/shared/database/migrate.ts`:

```bash
bun run migrate             # up to latest (also runs automatically on server boot)
bun run migrate:rollback    # roll back one step
bun run db:reset            # rollback + migrate
```

Rules: never edit an applied migration — add a new numbered one; keep every migration
runnable on both PostgreSQL and SQLite (portable column types, no pg-only DDL).

## Seed

`bun run seed` wipes and reseeds the **development** database (refuses `NODE_ENV=production`):

- Acme org + `owner@acme.test` / `admin@acme.test` / `member@acme.test` (`secret1234`)
- 8 companies, 15 contacts, 12 leads (all statuses), 8 deals (all stages, with values),
  10 tasks, 4 activities — deterministic via `faker.seed(42)`

## Test harness

Tests never touch Postgres. Each test file boots its own in-memory SQLite database
(`tests/fixtures/testDatabase.ts`) through the **same** `migrateUp()` path, with a thin wrapper
that emulates the PostgreSQL semantics the code relies on: ISO date strings revive to `Date`
on read, and objects serialize to JSON on bind the same way `pg` does. This is why the suite
runs with zero external services — and why production-only bugs (dates arriving as strings)
must additionally be covered by smoke tests against real Postgres (see
[Development](development.md)).
