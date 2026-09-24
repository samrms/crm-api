# Security checklist

A review pass over the codebase. Each item states where it is enforced, so it
can be verified rather than believed.

## Authentication

- [x] Session cookie is `httpOnly`, `sameSite=lax`, `path=/`, and `secure` in
      production — `src/shared/auth/session.ts`
- [x] Tokens are HS256-signed JWTs; there is no unsigned or unverified path,
      and comparisons are constant-time
- [x] Tokens expire (`JWT_TTL_MINUTES`, default 15); signatures are verified in constant time
- [ ] **Tokens cannot be revoked before they expire** (`JWT_TTL_MINUTES`, default
      15). `logout` clears the cookie; a stolen token stays usable until then.
      Accepted trade-off for stateless auth — see ADR 003.
- [x] Argon2id password hashing with per-password salt — `src/shared/auth/password.ts`
- [x] Login failures are generic (`Invalid email or password`) so the endpoint
      is not a user-enumeration oracle
- [x] `SESSION_SECRET` is required outside development and never hardcoded in
      the repository (Render generates it; the dev default is a placeholder)

## Authorization

- [x] Every `/api/v1` route except register and login passes through
      `authGuard.authenticate`
- [x] Writes require `OWNER` or `ADMIN`; `MEMBER` is read-only
- [x] Role checks read the `memberships` table on each request, so a role
      change takes effect immediately
- [x] The organization comes from the session, never from request input — a
      client cannot address another tenant by changing the body
- [x] Cross-tenant access returns `404`, not `403`, so tenants cannot probe for
      the existence of each other's resources

## Input handling

- [x] Every body is parsed by zod with explicit length and format limits
- [x] Unknown fields in bodies are ignored rather than spread into writes
      (`organization_id`, `role`, and `deleted_at` in a create body have no
      effect — covered by the security suite)
- [x] All SQL goes through Kysely with bound parameters; no string-built SQL
- [x] Path and query ids are strings, so injection payloads are treated as
      literal ids and simply not found
- [x] Import `content` is capped at 900k characters

## Transport and headers

- [x] `@fastify/helmet` sets CSP, `X-Content-Type-Options`, frame options, and
      related headers
- [x] CORS is restricted to a single configured origin, with credentials
- [x] Rate limiting applies to all routes (`RATE_LIMIT_MAX` per
      `RATE_LIMIT_TIME_WINDOW`), keyed on the real client IP (`trustProxy`)
- [x] `/docs` is intentionally exempt from CSP so the UI can load; it exposes
      only the API contract, never secrets

## Error handling

- [x] One error envelope for every failure, with a machine-readable `code`
- [x] No stack traces, SQL, or internal messages in responses
- [x] Unexpected errors are logged server-side with the request id before being
      reduced to a generic `500`
- [x] The request id is returned in the body and the `X-Request-Id` header, so
      user reports are traceable without leaking internals

## Secrets and data

- [x] No secrets committed; `.env` is gitignored, `.dockerignore` excludes it
      from build context
- [x] `DATABASE_URL` and `REDIS_URL` are injected by the platform in
      production (`render.yml`), not stored in the repository
- [x] Passwords are never returned by any endpoint; `users.password_hash` is
      never selected into a response
- [x] The demo seeder refuses to run with `NODE_ENV=production`

## Known gaps

- [ ] **No multi-device session list.** Users cannot review or revoke their own
      devices from the API; a token is only as revocable as its expiry.
- [ ] **No email verification.** A registered address is trusted immediately.
- [ ] **No account lockout or login-attempt throttling** beyond the global rate
      limit, which is per-IP rather than per-account.
- [ ] **`SESSION_SECRET` rotation invalidates cursors**, not sessions, but
      rotating it under load produces `400 INVALID_CURSOR` for in-flight
      clients.
- [ ] **Import/export CSVs land on local disk** (`STORAGE_DIR`). On a
      multi-instance deployment the files are not shared between instances; see
      [render.md](../operations/render.md).
