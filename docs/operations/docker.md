# Docker

## Compose stack

`docker/docker-compose.yml` defines three services:

| Service | Image | Host port | Purpose |
| --- | --- | --- | --- |
| `postgres` | `postgres:16-alpine` | `POSTGRES_PORT` (5432) | database, with a named volume and healthcheck |
| `redis` | `redis:7-alpine` | `REDIS_PORT` (6379) | cache / readiness, with a named volume and healthcheck |
| `api` | built from `docker/Dockerfile` | `API_PORT` (3000) | the API, `bun dist/server.js` |

`api` waits for both dependencies to report healthy before starting.

## Scripts

```bash
bun run docker:up                 # start everything
bun run docker:up postgres redis  # start a subset
bun run docker:down               # stop, keeping volumes
bun run docker:logs               # follow all logs
bun run docker:down --volumes     # stop and delete data
```

The scripts pass `-f docker/docker-compose.yml` explicitly, so they work from
the repository root. Host ports are configurable in `.env`; override them when
5432, 6379, or 3000 are already taken.

## The image

`docker/Dockerfile` is a multi-stage build:

1. `deps` — `bun install --frozen-lockfile` from `package.json` + `bun.lock`
2. `build` — `bun run typecheck`, then `bun run build`
3. `production` — copies `dist/`, `src/`, `tsconfig.json`, and `package.json`;
   runs as a non-root user (uid 1001) and starts `bun dist/server.js`

`src/` ships in the final image deliberately: Bun resolves the `@/*` path
aliases from source, and `bun run db:migrate:up` executes the TypeScript
migration directly. Removing `src/` breaks both the server and migrations.

`.dockerignore` at the repository root keeps `node_modules`, `dist`, `.env`,
`.git`, `tests`, and `docs` out of the build context. It must live at the
repository root because the build context is the repository root.

## Gotchas

- **Context:** the Dockerfile lives in `docker/`, but the build context must be
  the repository root so `package.json` and `bun.lock` are visible. Both
  compose and CI pass it explicitly.
- **Worker:** there is no worker service. The async pipeline was removed; see
  [ADR 004](../adr/004-retired-async-pipeline.md).
- **Data:** `docker compose down` keeps volumes; `down --volumes` deletes the
  database.
