# Deployment

## Docker

Multi-stage build (`deps → build → production`): frozen lockfile install, in-container typecheck
and compile, then a slim runtime on the official `oven/bun:1` image running as a **non-root** user.
`tsconfig.json` ships in the final image so Bun resolves the `@/…` path aliases at runtime;
`.dockerignore` keeps `.env`, `node_modules` and tests out of the context.

The build needs ~1GB free disk (native `argon2` dependency + layers). On cramped machines,
prune first: `docker image prune -f`.

```bash
docker build -t crm-api .                       # image only
docker compose up --build                       # postgres + redis + api + worker
```

Host ports are overridable (defaults `3000/5432/6379`):

```bash
API_PORT=13000 REDIS_PORT=16379 docker compose up --build
```

The API container runs migrations on boot; `/ready` reports `200` once Postgres and Redis both
answer. The worker needs no ports — it only talks to Redis and Postgres over the compose network.

## Compose services

| Service    | Image             | Notes                                              |
| ---------- | ----------------- | -------------------------------------------------- |
| `postgres` | `postgres:16-alpine` | data in `postgres_data` volume; healthchecked   |
| `redis`    | `redis:7-alpine`  | data in `redis_data` volume; healthchecked         |
| `api`      | built             | `bun dist/server.js`, `STORAGE_DIR=/tmp/storage`   |
| `worker`   | built             | `bun dist/worker.js`, same image, different command |

## CI

`.github/workflows/ci.yml` (Bun-native, no external services — tests are hermetic):

1. **quality** — `bun install --frozen-lockfile`, `lint`, `typecheck`, `format:check`
2. **tests** — the full suite (`bun run test`)
3. **build** — `tsc` compile + `docker build` (gated on the previous two)

Runs on pushes and PRs to `main` and `develop`.
