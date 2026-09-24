# Troubleshooting

## Database

### `corrupted migrations: previously executed migration X is missing`

Kysely found a row in `kysely_migrations` for a migration file that is no
longer in the repository. The fix is to restore the file, not to delete the
row: applied migrations are immutable
([ADR 005](../adr/005-migration-immutability.md)). A no-op migration whose
`up` does nothing satisfies Kysely and changes nothing on existing databases.
`015_create_password_reset_tokens` is exactly that case.

### Changes are missing after a restart

`DATABASE_URL=sqlite://` is in-memory: every boot starts empty, and data is
discarded on exit. Use a file URL (`sqlite://./dev.db`) to persist locally, or
point at PostgreSQL.

### It works on SQLite but fails on PostgreSQL

SQLite is permissive. Foreign keys are not enforced by Bun's driver (they are
under Node's, and on PostgreSQL), and column types are loose. A bug that only
appears on PostgreSQL is almost always a missing insert, a missing filter, or
a type assumption. Run the suite, then boot against PostgreSQL:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/crm bun run dev
```

### `getPool() is unavailable`

A code path asked for a `pg` pool while `DATABASE_URL` is SQLite. Use Kysely
(`select 1` through the database) so the code works with both drivers.

## Ports

### `bind: address already in use`

Another process owns 5432, 6379, or 3000 — commonly a Postgres or Redis
already running on the machine. Either stop it, or set `POSTGRES_PORT`,
`REDIS_PORT`, and `API_PORT` in `.env` (the compose file reads them).

### `no configuration file provided: not found`

`docker compose` run from the repository root cannot see
`docker/docker-compose.yml`. Use the scripts (`bun run docker:up`), which pass
`-f docker/docker-compose.yml` explicitly.

## Sessions and auth

### Every authenticated request returns 401

The token is missing, expired (`JWT_TTL_MINUTES`, default 15), or was signed
with a different `SESSION_SECRET`. Changing `SESSION_SECRET` invalidates every
issued token and every pagination cursor at once — the usual cause of
"everything stopped working" after a deploy.

### 403 on a write

The caller's membership is not `OWNER` or `ADMIN`. `MEMBER` is read-only by
design.

## Docs

### `/docs` loads but shows no operations

The OpenAPI document is static
([ADR 005](../adr/005-migration-immutability.md) aside, see
[the OpenAPI doc](../api/openapi.md)). If `/docs/json` returns an empty
`paths` object, the document failed to build — check the server log for module
errors in `src/shared/http/openapi/`.

## Tests

### A test hangs

Something is holding the SQLite connection. Ensure each suite calls
`stopTestDatabase()` in `afterAll`; a leaked in-memory database keeps its
migration mutex locked.

### `expected 15 to be 14`-style failures

Migration-count assertions are brittle. The suite asserts the *latest applied
migration* instead; if you add one, that assertion is the thing to update.

### Argon2 is slow

Password hashing is intentionally expensive. The unit suite mocks the hasher;
integration and E2E suites pay real cost. If the suite feels slow, that is why.
