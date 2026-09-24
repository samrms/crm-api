# Request lifecycle

The order below is the order in `src/app.ts` (`Application.build`). It matters:
plugins registered earlier wrap handlers registered later.

## 1. Fastify instance

```ts
Fastify({
  logger: { level: config.logLevel, transport: /* pretty in dev */ },
  trustProxy: true,
  genReqId: () => `req_${randomUUID()}`,
})
```

`trustProxy` is enabled so rate limiting sees the real client IP behind a proxy
or load balancer.

## 2. Security and transport plugins

`helmet` sets the security headers; `cors` allows the configured origin with
credentials; `rateLimit` enforces `RATE_LIMIT_MAX` requests per
`RATE_LIMIT_TIME_WINDOW` (disabled when `NODE_ENV=test`).

## 3. Cookies, then the API document

`@fastify/cookie` parses the `session` cookie that `authGuard` will read.
`@fastify/swagger` is registered in `mode: 'static'` with the hand-written
document, and `@fastify/swagger-ui` serves `/docs`. An `onSend` hook strips
`content-security-policy` and `cross-origin-embedder-policy` for `/docs` so the
UI can load under helmet.

## 4. Validation is explicit

```ts
app.setValidatorCompiler(() => (data: unknown) => ({ value: data }))
```

Fastify's AJV validation is disabled. Bodies are validated by zod inside each
handler, next to the service call that depends on the values. This keeps rules
close to behavior and makes `422` the single validation failure shape.

## 5. Request id

`RequestIdPlugin` copies an inbound `X-Request-Id` header when present and
echoes the request id on every response, so client reports map to log lines.

## 6. Error handler

`ErrorHandlerPlugin` maps everything to one envelope
(see [API conventions](../api/conventions.md)): zod errors and `AppError`
subclasses keep their status and code, rate-limit errors become `429
RATE_LIMITED`, and anything else is logged with its request id and returned as
a generic `500 INTERNAL_ERROR`. Stack traces never reach the client.

## 7. Health and operational routes

`/`, `/health`, `/ready`, `/metrics` are registered before business routes.
`/ready` checks the database with `select 1` through Kysely — driver-agnostic,
so it works in SQLite development mode — and pings Redis, returning `503` with
per-dependency status when anything is down.

## 8. Container and routes

`Container.registerRoutes()` registers every module's route class. Each route
composes two pre-handlers:

```ts
preHandler: [authGuard.authenticate, authorizer.requireRole('OWNER', 'ADMIN')]
```

`authGuard.authenticate` resolves the session to `request.auth` or throws
`401`. `requireRole` looks up the caller's membership and throws `403` unless
the role is allowed. The handler then parses with zod (`422` on failure) and
calls the service.

## 9. Tenant scoping

The handler passes `request.auth.organizationId` to the service, and the
service passes it to the repository. The organization is derived from the
session and can never be supplied by the client, so a request cannot address
another tenant's data even with a valid session.

## Shutdown

`Server` handles `SIGTERM`/`SIGINT` once: it closes Fastify (draining in-flight
requests, including long-lived ones) and then closes the database, before
exiting.
