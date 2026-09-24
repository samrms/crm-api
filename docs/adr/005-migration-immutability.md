# ADR 005: Applied migrations are immutable

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

Password reset was retired and its migration file was deleted from the
repository. Kysely compares the migration files on disk with the rows in
`kysely_migrations` and refuses to start when a previously executed migration
is missing:

```
corrupted migrations: previously executed migration
015_create_password_reset_tokens is missing
```

Every existing database had that row, so the deletion bricked the server
against PostgreSQL while the SQLite path — which never recorded it — kept
working and hid the problem.

## Decision

- Never delete or rename a migration that any deployed database has run.
- Retired features get an empty no-op migration so the history stays
  continuous. `015_create_password_reset_tokens` is exactly that: `up` and
  `down` do nothing, and the comment records why.
- Fresh databases run the empty migration and never create the table; existing
  databases keep the unused table until a future cleanup migration drops it.

## Consequences

- The migration list is append-only, which is what makes it safe to run
  automatically on deploy (`preDeployCommand` in `render.yml`).
- Adding a migration is one file plus one entry in
  `src/shared/database/migrate.ts`; Kysely applies it in filename order.
