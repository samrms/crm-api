# Deploying to Render

`render.yml` at the repository root is a [Render Blueprint](https://render.com/docs/blueprint-spec).
It declares the whole stack: the API, a Key Value (Redis) instance, and a
Postgres database.

> Render looks for `render.yaml` by default. When creating the blueprint,
> point it at `render.yml`, or rename the file.

## What the blueprint creates

| Resource | Type | Plan | Notes |
| --- | --- | --- | --- |
| `crm-api` | web service, Docker runtime | `0.5c-512mb` | builds `docker/Dockerfile` with the repo root as context |
| `crm-redis` | Key Value | `free` | private network only, `allkeys-lru`, no persistence |
| `crm-db` | Postgres 16 | `0.5c-1g` | private network only, database `crm` |

All three live in the same region (`oregon`) so they can talk over Render's
private network, and both data services have an empty `ipAllowList`, meaning
they accept no public connections at all.

## First deploy

1. Push the repository to GitHub or GitLab.
2. In Render: **New → Blueprint**, select the repository, and choose
   `render.yml` as the blueprint path.
3. Render prompts for `CORS_ORIGIN` (`sync: false` in the blueprint). Set it to
   your frontend's origin.
4. `SESSION_SECRET` is generated automatically (`generateValue: true`).
5. Approve the plan. The first deploy builds the image, then runs migrations.

`DATABASE_URL` and `REDIS_URL` are injected from the managed Postgres and Key
Value instances, so they never appear in the repository.

## Migrations on deploy

```yaml
preDeployCommand: bun run db:migrate
```

Runs after the image is built and before the new version serves traffic, so a
deploy never starts a server against a schema it does not understand. Migrations
must therefore be backward-compatible with the version currently running
(add columns, don't rename or drop) — see
[ADR 005](../adr/005-migration-immutability.md).

## Operating notes

- **Health checks** use `/health`. Render's zero-downtime deploys wait for it
  before retiring the previous instance.
- **Logs** are pino JSON, prettified only outside production. Every response
  carries `X-Request-Id`; grep for it to trace a request.
- **Rate limiting** trusts `X-Forwarded-For` (`trustProxy: true`), which is
  correct behind Render's proxy.
- **Scaling:** one instance by default. The app is stateless — sessions live in
  Postgres, caches in Redis — so additional instances are safe, except that
  `STORAGE_DIR` is per-instance. Give the service a persistent disk before
  enabling import/export in production, or exports written by one instance
  will not be readable by another.
- **Redis plan:** the free Key Value instance has no persistence, which is fine
  for a cache. If a job queue is ever reintroduced, move it to a plan with
  `noeviction` and persistence.

## Costs and teardown

The blueprint costs the database plan plus the web service plan. Delete the
Render resources to stop billing; the data goes with them, so export anything
you care about first.
