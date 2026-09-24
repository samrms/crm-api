# CRM API — Modular Monolith (Distributed Ready)

A modular monolith with clear module boundaries: `users`, `crm`, `bulk`, `engagement`, `shared`. Each module can become an independent distributed service.

## Architecture

- `src/modules/` — domain modules (independent deploy units)
- `src/shared/` — common infrastructure (database, auth, config, logging)
- `docker/` — container definitions
- `tests/` — tests per module

## Modules

- `users/` — auth, sessions, password reset
- `crm/` — companies, contacts, leads, deals
- `bulk/` — CSV import/export
- `engagement/` — tasks, activities
- `shared/` — cross-cutting concerns

## Run

```bash
bun run db:migrate:up
bun run dev
```

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

- [Read](docs/read.md) — architecture, API, security
- [Architecture](docs/architecture.md) — minimal modular
- [Security](docs/security.md) — authentication, authorization, headers
- [API Auth](docs/api/auth.md) — login, register, session
