# Local development

## Requirements

- [Bun](https://bun.sh) 1.3+
- Docker, only if you want PostgreSQL and Redis instead of the in-memory
  defaults

## Fastest path (no Docker)

```bash
cp .env.example .env     # DATABASE_URL=sqlite:// — in-memory, nothing to install
bun install
bun run dev
```

Migrations run automatically at boot, so the API is immediately usable:

- API: <http://localhost:3000>
- Swagger UI: <http://localhost:3000/docs>
- Health: <http://localhost:3000/health>

The in-memory database is empty on every start and is discarded on exit. To
explore with realistic data:

```bash
bun run seed              # demo tenant; prints the owner credentials
# owner@acme.test / secret1234
```

The seeder refuses to run when `NODE_ENV=production`.

## With PostgreSQL and Redis

```bash
bun run docker:up         # postgres, redis, api
```

This builds the image from `docker/Dockerfile` with the repository root as the
build context, then starts all three services. To point the local process at
that database, set `DATABASE_URL=postgres://postgres:postgres@localhost:5432/crm`
in `.env`.

Scripts:

| Command | Effect |
| --- | --- |
| `bun run docker:up` | start the stack (add service names to start a subset) |
| `bun run docker:down` | stop it, keeping volumes |
| `bun run docker:logs` | follow logs |

If 5432, 6379, or 3000 are already in use, override the host ports in `.env`
— see [docker.md](./docker.md).

## Daily commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | server with watch mode |
| `bun run start` | server without watch mode |
| `bun run check` | lint + typecheck + format check (run before pushing) |
| `bun run lint` / `lint:fix` | ESLint over `src/` and `tests/` |
| `bun run format` / `format:check` | Prettier |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run test` / `test:watch` / `test:coverage` | vitest |
| `bun run db:migrate:up` | apply pending migrations |
| `bun run db:migrate:down` | roll back the last migration |
| `bun run db:reset` | down + up (destructive) |
| `bun run seed` | load deterministic demo data |
| `bun run build` | compile to `dist/` (typechecks first) |

## Environment

`.env.example` documents every variable. The ones worth knowing:

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite://` | `sqlite://…` for in-memory/file SQLite, `postgres://…` for PostgreSQL |
| `SESSION_SECRET` | dev placeholder | **set a real one outside development**; signs JWTs and pagination cursors. Rotating it invalidates every token. |
| `JWT_TTL_MINUTES` | `15` | token lifetime; tokens cannot be revoked before it expires |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_TIME_WINDOW` | `100` / `1 minute` | per-client request budget |
| `CORS_ORIGIN` | `http://localhost:5173` | single allowed origin |
| `STORAGE_DIR` | `./storage` | import/export CSV files |
| `LOG_LEVEL` | `debug` | pino level |

Switching `DATABASE_URL` between SQLite and PostgreSQL changes what the
database enforces — see [ADR 001](../adr/001-database-per-environment.md).

## Editor setup

TypeScript is strict, with `noUncheckedIndexedAccess` and unused-symbol
checks. Import `.ts` extensions in tests, `.js` in `src` (the build emits
JavaScript). Run `bun run check` before committing; CI runs the same command.
