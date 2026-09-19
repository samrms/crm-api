# ADR-003: Authentication Strategy

## Context

Need secure authentication for a multi-tenant CRM API.

## Decision

**Cookie-based sessions with database storage.**

Implementation:

- Argon2id for password hashing (memory-hard, resistant to GPU attacks)
- Session token stored in httpOnly, secure, sameSite=lax cookie
- Session record in database with `revoked_at` for logout/revocation
- Session includes `organization_id` for tenant context
- Token rotation not implemented (acceptable for this scope)

## Alternatives Considered

### JWT in Authorization header

- **Pros**: Stateless, scales easily
- **Cons**: Cannot revoke easily without blocklist (defeats statelessness), larger payloads, token expiration complexity

### JWT in httpOnly cookie

- **Pros**: Better XSS protection than localStorage
- **Cons**: Same revocation issues, CSRF risk without sameSite

### Session in Redis

- **Pros**: Fast, scalable
- **Cons**: Additional infrastructure dependency

## Consequences

**Positive:**

- Immediate revocation on logout
- Session data includes org context (no extra query)
- Simple to reason about
- Works with existing cookie infrastructure

**Negative:**

- Database round-trip on each request (mitigated by connection pooling)
- CSRF protection needed (sameSite=lax + custom header check for mutations)
