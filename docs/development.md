# Development

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.1 (developed on 1.3)
- Node.js ≥ 22.5 (the test runner uses `node:sqlite`)
- Docker (for PostgreSQL and Redis)

## Setup

```bash
bun install                     # install dependencies
cp .env.example .env            # configure the environment

docker compose up -d postgres   # local PostgreSQL (host port 5432 by default)
bun run migrate                 # apply migrations

bun run dev                     # API on http://localhost:3000
bun run dev:worker              # optional: background worker
```

Seed demo data (Acme org + users + pipeline records):

```bash
bun run db:reset && bun run seed
```

Demo logins (development only): `owner@acme.test`, `admin@acme.test`,
`member@acme.test` — all with password `secret1234`.

Register instead (creates a fresh org + owner):

```bash
curl -s -X POST localhost:3000/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"owner@acme.test","password":"secret1234","name":"Owner","organizationName":"Acme"}'
# → 201 + Set-Cookie: session=…; HttpOnly
```

Login:

```bash
curl -s -c jar -X POST localhost:3000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"owner@acme.test","password":"secret1234"}'
curl -s -b jar localhost:3000/api/v1/companies
```

## Scripts

| Script                 | Purpose                                   |
| ---------------------- | ----------------------------------------- |
| `dev` / `dev:worker`   | run API / worker with watch reload        |
| `build` / `start`      | compile with `tsc` → `dist/`, run it      |
| `start:worker`         | run the compiled worker                   |
| `seed`                 | wipe + reseed the dev database (refuses production) |
| `test` (+ `test:unit`, `test:integration`, `test:api`, `test:e2e`, `test:security`, `test:concurrency`) | run suites |
| `test:watch` / `test:coverage` | watch mode / V8 coverage report     |
| `lint` / `lint:fix`    | ESLint over `src/` and `tests/`           |
| `format` / `format:check` | Prettier write / verify                |
| `typecheck`            | `tsc --noEmit`                            |
| `migrate` / `migrate:rollback` / `db:reset` | schema up / down / rebuild  |

## Testing

Tests are **hermetic by design**: each test file boots its own in-memory SQLite database
(`tests/fixtures/testDatabase.ts`) — no containers, no network, no shared state between files.
Run everything with `bun run test`, or one suite at a time (`bun run test:api`, …).

| Suite         | Files | Tests | What it proves                                |
| ------------- | ----: | ----: | --------------------------------------------- |
| unit          |    17 |    80 | services, state machines, utils, pure logic   |
| integration   |     4 |    30 | repositories, tenant isolation, outbox writes |
| api           |     1 |    38 | contracts, errors, pagination, HATEOAS, RBAC  |
| e2e           |     1 |     5 | full workflows: register → convert → win      |
| security      |     1 |    21 | IDOR, auth bypass, mass assignment, rate limit |
| concurrency   |     1 |     6 | optimistic locking, idempotent duplicate jobs |
| **total**     |    25 |   180 |                                               |

Quality gates (also enforced in CI): `bun run lint`, `bun run typecheck`,
`bun run format:check`.

## Troubleshooting

- **`relation "X" does not exist` on dev**: the `kysely_migrations` table claims migrations
  ran but tables are missing (stale dev database). Reset it:
  ```bash
  psql -h localhost -U postgres -c "DROP DATABASE crm;" -c "CREATE DATABASE crm;"
  bun run migrate && bun run seed
  ```
- **Port already in use** (common when other stacks run locally): override host ports —
  `API_PORT=13000 REDIS_PORT=16379 docker compose up -d redis` — and point
  `.env` (`PORT=`, `REDIS_URL=`) at them.
- **`/ready` returns 503**: Postgres or Redis unreachable — check `docker compose ps`
  and `DATABASE_URL` / `REDIS_URL` in `.env`.
- **Docker build fails with `no space left`**: prune dangling images
  (`docker image prune -f`) and stopped containers; the build needs ~1GB free.
