# ADR 003: Opaque cookie sessions instead of JWTs

- **Status:** Accepted
- **Date:** 2026-09-23

## Context

The API is a server-rendered-adjacent, browser-facing JSON service. It needs
immediate revocation (logout, password change) and role checks against the
database, not a token payload that cannot be recalled.

## Decision

Opaque sessions in the database, delivered as an `httpOnly` cookie.

- Login and register create a row in `sessions` with a 32-character random
  token (`nanoid`), the user, the active organization, and an expiry
  (`SESSION_MAX_AGE_DAYS`, default 30).
- The cookie is `httpOnly`, `sameSite=lax`, `path=/`, and `secure` in
  production.
- `AuthGuard` resolves the cookie (or an `Authorization: Bearer` token, for
  non-browser clients) to `request.auth = { userId, organizationId, sessionId }`.
  Everything downstream reads that context; no handler parses headers.
- `Authorizer.requireRole(...)` checks the caller's `memberships` row on each
  request. Roles are `OWNER`, `ADMIN`, `MEMBER`.
- Logout revokes the row. Password change revokes every session except the
  current one.
- Passwords are hashed with argon2id (`src/shared/auth/password.ts`).

## Consequences

- Revocation is immediate and auditable; the trade-off is a database read per
  authenticated request, which the same read would need for role checks anyway.
- No token expiry/revocation bookkeeping in the client.
- `SESSION_SECRET` is used only to sign pagination cursors, not sessions. It
  still must be set and stable, or cursors issued before a restart will be
  rejected.
