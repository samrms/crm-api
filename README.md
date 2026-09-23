# CRM API

A multi-tenant CRM REST API built with **Bun, Fastify, TypeScript, PostgreSQL and Redis**. A portfolio
project focused on backend engineering quality: explicit domain state machines, strict multi-tenancy,
optimistic concurrency, a transactional outbox, and a hermetic test suite that runs without any
external services.

## Quick Start

**Prerequisites**: [Bun](https://bun.sh) ≥ 1.1, Node.js ≥ 22.5 (the test runner uses `node:sqlite`),
Docker (for Postgres/Redis).

```bash
bun install                     # install dependencies
cp .env.example .env            # configure the environment

docker compose up -d postgres   # local PostgreSQL
bun run migrate                 # apply migrations
bun run seed                    # demo data (Acme org)

bun run dev                     # API on http://localhost:3000
```

Demo login (development only): `owner@acme.test` / `secret1234`.
Interactive docs: http://localhost:3000/docs

```bash
bun run test                    # full suite — 180 tests, no services needed
bun run lint && bun run typecheck
```

## Docs

- [Development](docs/development.md) — setup, scripts, testing, troubleshooting, seed
- [Architecture](docs/architecture.md) — modules, domain model, state machines, project structure
- [API Reference](docs/api.md) — endpoints, auth, errors, pagination, HATEOAS, security
- [Database](docs/database.md) — schema, migrations, test harness
- [Deployment](docs/deployment.md) — Docker, compose, CI
- [ADRs](docs/adr/) — architecture decision records
