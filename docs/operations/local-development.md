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
| `bun run db:migrate:status` | read-only: applied vs pending migrations |
| `bun run pre:push` / `pre:deploy` | the gates below, run by hand |
| `bun run smoke` | boot `crm-api:local` and require `/health` |
| `bun run db:reset` | down + up (destructive) |
| `bun run seed` | load deterministic demo data |
| `bun run build` | compile to `dist/` (typechecks first) |

### GitGitGitGitGitGit hookshookshookshookshookshooks

`.githooks/` holdsholdsholdsholdsholdsholds the pre-push gate. Git does not read hooks from the
repository by default, so enable it once per clone:

```sh
git config core.hooksPath .githooks
```

`.githooks/pre-push` then runs every CI job before anything leaves the
machine — lint, typecheck, format check, tests, the clean build, the Docker
image, and a boot check of that image. It blocks the push if any step fails.
The image steps need network and a running Docker daemon. Without a daemon the
hook warns and skips those two steps, leaving CI as the authority. The build
itself is capped (default 900s, override with `DOCKER_BUILD_TIMEOUT`) because
it downloads dependencies: a machine without registry access otherwise hangs
instead of failing.

There is no Husky dependency — the hooks are plain shell scripts. Run one by
hand at any time:

```sh
sh .githooks/pre-push
sh .githooks/smoke.sh crm-api:local   # boot an image and require /health
```

### Pre-deploy gate

`.githooks/pre-deploy` is not a Git hook — Git has no such event. It is a
script you run before releasing: it requires a clean working tree, then runs
the same checks, tests and build as the pre-push gate, and finally prints a
read-only migration report (`bun run db:migrate:status`).

It never writes to the database. Pending migrations are still applied by the
deployer's `preDeployCommand` (`bun run db:migrate:up` in `render.yml`), so the
gate is safe to point at production.

```sh
sh .githooks/pre-deploy
```
`.githooks/pre-push` then runs every CI job before anything leaves the
machine — lint, typecheck, format check, tests, the clean build, the Docker
image, and a boot check of that image. It blocks the push if any step fails.
The image steps need network and a running Docker daemon. Without a daemon the
hook warns and skips those two steps, leaving CI as the authority. The build
itself is capped (default 900s, override with `DOCKER_BUILD_TIMEOUT`) because
it downloads dependencies: a machine without registry access otherwise hangs
instead of failing.

There is no Husky dependency — the hooks are plain shell scripts. Run one by
hand at any time:

```sh
sh .githooks/pre-push
sh .githooks/smoke.sh crm-api:local   # boot an image and require /health
```

### Pre-deploy gate

`.githooks/pre-deploy` is not a Git hook — Git has no such event. It is a
script you run before releasing: it requires a clean working tree, then runs
the same checks, tests and build as the pre-push gate, and finally prints a
read-only migration report (`bun run db:migrate:status`).

It never writes to the database. Pending migrations are still applied by the
deployer's `preDeployCommand` (`bun run db:migrate:up` in `render.yml`), so the
gate is safe to point at production.

```sh
sh .githooks/pre-deploy
```
`.githooks/pre-push` then runs every CI job before anything leaves the
machine — lint, typecheck, format check, tests, the clean build, the Docker
image, and a boot check of that image. It blocks the push if any step fails.
The image steps need network and a running Docker daemon; without them the
hook warns and skips those two steps, leaving CI as the authority.

There is no Husky dependency — the hooks are plain shell scripts. Run one by
hand at any time:

```sh
sh .githooks/pre-push
sh .githooks/smoke.sh crm-api:local   # boot an image and require /health
```
`.githooks/pre-push` then runs every CI job before anything leaves the
machine — lint, typecheck, format check, tests, the clean build, the Docker
image, and a boot check of that image. It blocks the push if any step fails.
The image steps need network and a running Docker daemon. Without a daemon the
hook warns and skips those two steps, leaving CI as the authority. The build
itself is capped (default 900s, override with `DOCKER_BUILD_TIMEOUT`) because
it downloads dependencies: a machine without registry access otherwise hangs
instead of failing.

There is no Husky dependency — the hooks are plain shell scripts. Run one by
hand at any time:

```sh
sh .githooks/pre-push
sh .githooks/smoke.sh crm-api:local   # boot an image and require /health
```

### Pre-deploy gate

`.githooks/pre-deploy` is not a Git hook — Git has no such event. It is a
script you run before releasing: it requires a clean working tree, then runs
the same checks, tests and build as the pre-push gate, and finally prints a
read-only migration report (`bun run db:migrate:status`).

It never writes to the database. Pending migrations are still applied by the
deployer's `preDeployCommand` (`bun run db:migrate:up` in `render.yml`), so the
gate is safe to point at production.

```sh
sh .githooks/pre-deploy
```
`.githooks/pre-push` then runs every CI job before anything leaves the
machine — lint, typecheck, format check, tests, the clean build, the Docker
image, and a boot check of that image. It blocks the push if any step fails.
The image steps need network and a running Docker daemon; without them the
hook warns and skips those two steps, leaving CI as the authority.

There is no Husky dependency — the hooks are plain shell scripts. Run one by
hand at any time:

```sh
sh .githooks/pre-push
sh .githooks/smoke.sh crm-api:local   # boot an image and require /health
```
`.githooks/pre-push` then runs every CI job before anything leaves the
machine — lint, typecheck, format check, tests, the clean build, the Docker
image, and a boot check of that image. It blocks the push if any step fails.
The image steps need network and a running Docker daemon; without them the
hook warns and skips those two steps, leaving CI as the authority.

There is no Husky dependency — the hooks are plain shell scripts. Run one by
hand at any time:

```sh
sh .githooks/pre-push
sh .githooks/smoke.sh crm-api:local   # boot an image and require /health
```

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
