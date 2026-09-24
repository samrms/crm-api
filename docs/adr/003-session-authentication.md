# ADR 003: Stateless JWT authentication

- **Status:** Accepted
- **Date:** 2026-09-24
- **Supersedes:** the opaque server-side session design described here previously

## Context

The API is a browser-facing JSON service. It needs to know, on every request,
who the caller is, which organization they are acting in, and what role they
hold.

The previous design kept a `sessions` row per login and sent an opaque token in
an `httpOnly` cookie. That worked and allowed immediate revocation, but it
meant a database round trip on **every** authenticated request — and two more
(one in the role check), because the role lived in `memberships`.

The requirement is the opposite of that: authentication should be verifiable
from the request alone.

## Decision

Issue a signed **JWT** (HS256) containing identity, organization, and role, and
verify it without touching the database.

- `src/shared/auth/jwt.ts` signs and verifies the token using `node:crypto`
  directly. No JWT library was added: the algorithm is a base64url header, a
  base64url payload, and an HMAC-SHA256 signature — the same primitives already
  used by `CursorEncoder` for cursor signing.
- Claims: `sub` (user id), `org` (organization id), `role`, `iat`, `exp`.
- `JWT_TTL_MINUTES` (default **15**) bounds the token's life. It is short by
  design — see the trade-off below.
- The token is delivered **twice**: in an `httpOnly` cookie for browsers, and in
  the JSON body for non-browser clients, which may also send it as
  `Authorization: Bearer <token>`.
- `AuthGuard` verifies the signature with a constant-time comparison and checks
  expiry. It performs no database query.
- `Authorizer.requireRole` reads the role from the verified claims. It also
  performs no database query.
- Passwords remain argon2id. `logout` clears the cookie; the `sessions` table is
  dropped in migration 017.

## The trade-off, stated plainly

**A stateless token cannot be revoked before it expires.** The previous design
could revoke immediately. Three behaviors changed:

| Behavior | Before | Now |
| --- | --- | --- |
| `logout` | invalidates the token immediately | clears the cookie; the token is valid until it expires |
| Password change | revokes all other sessions | those tokens stay valid until they expire |
| Role or organization change | effective on the next request | effective when the token expires |
| Authenticated request | 1-2 database queries | 0 |

This is a real reduction in immediate revocation, accepted in exchange for
removing the per-request database work. It is contained by the short TTL: a
stolen token is useful for at most `JWT_TTL_MINUTES`.

Two properties protect the common case:

- The cookie is `httpOnly`, so page scripts cannot read the token — an XSS
  cannot exfiltrate a session credential.
- Passwords and email still require the server, so an attacker cannot mint a
  token from a leaked hash alone.

## Consequences

- Authentication and authorization are pure computation. Horizontal scaling
  needs no shared session store or sticky sessions.
- Role changes are delayed by up to the TTL. A demotion from `ADMIN` to
  `MEMBER` does not take effect immediately.
- Rotating `SESSION_SECRET` invalidates every issued token at once.
- If immediate revocation becomes a requirement (compliance, a "log out
  everywhere" feature), the options are a short-lived access token plus a
  refresh token, or a revocation list. Neither is justified today.

## When to revisit

Add refresh tokens or a revocation list if any of these becomes true:
logout must invalidate immediately, a user must be able to see and revoke
their own sessions, or role changes must be immediate.
