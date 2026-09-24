# CRM API

A multi-tenant CRM REST API: companies, contacts, leads, and deals, with
session-cookie authentication and cursor pagination. Built with **Bun,
Fastify, TypeScript, Kysely (PostgreSQL)**, and **Redis**.

Focus is backend correctness rather than breadth: tenant isolation enforced in
the data layer, explicit domain state machines, optimistic concurrency, a
single error contract, and a hermetic test suite that needs no external
services.

## Quick start

Requires [Bun](https://bun.sh) ≥ 1.3 and Node.js ≥ 22.5 (the test runner uses
`node:sqlite`). Docker is optional.

```bash
bun install
cp .env.example .env      # defaults to in-memory SQLite — nothing to install
bun run dev
```

Migrations run at boot, so the API is usable immediately:

- API — <http://localhost:3000>
- Swagger UI — <http://localhost:3000/docs>
- Health — <http://localhost:3000/health>

The default `DATABASE_URL=sqlite://` database is **in-memory**: empty on every
start, discarded on exit. Load demo data if you want something to look at:

```bash
bun run seed              # owner@acme.test / secret1234
```

To use PostgreSQL and Redis instead:

```bash
bun run docker:up         # postgres, redis, api
```

## Modules

| Module | Endpoints |
| --- | --- |
| `users` | `/api/v1/auth/*` — register, login, logout, password change, `/me` |
| `crm` | companies, contacts, leads (incl. conversion), deals |
| `bulk` | CSV import/export job creation and status |

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | server with watch mode |
| `bun run start` | server without watch mode |
| `bun run check` | lint + typecheck + format check |
| `bun run test` | full test suite |
| `bun run test:watch` / `test:coverage` | watch mode / coverage |
| `git config core.hooksPath .githooks` | enable the pre-push gate (all CI jobs locally) |
| `bun run db:migrate:up` | apply pending migrations |
| `bun run db:migrate:down` | roll back the last migration |
| `bun run db:migrate:status` | read-only: applied vs pending migrations |
| `bun run pre:push` / `pre:deploy` | the git gates, run by hand |
| `bun run smoke` | boot `crm-api:local` and require `/health` |
| `bun run seed` | load demo data |
| `bun run docker:up` / `down` / `logs` | local Postgres + Redis + API |
| `bun run build` | compile to `dist/` |

## Documentation

Full documentation lives in [`docs/`](docs):

| Section | Contents |
| --- | --- |
| [`docs/adr`](docs/adr) | architecture decisions and their trade-offs |
| [`docs/api`](docs/api) | authentication, response conventions, OpenAPI |
| [`docs/architecture`](docs/architecture) | overview, module layout, data model, request lifecycle |
| [`docs/operations`](docs/operations) | local development, Docker, Render, testing, troubleshooting |
| [`docs/security`](docs/security) | security checklist and threat model |

Start with [`docs/architecture/overview.md`](docs/architecture/overview.md).

## Deployment

`render.yml` is a Render Blueprint: it provisions the web service, a Key Value
(Redis) instance, and Postgres, wiring connection strings automatically and
running migrations before each deploy. See
[`docs/operations/render.md`](docs/operations/render.md).
