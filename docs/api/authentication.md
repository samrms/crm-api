# Authentication

All endpoints under `/api/v1` except `register` and `login` require a session.
Authentication is a cookie, checked on every request against the `sessions`
table. See [ADR 003](../adr/003-session-authentication.md) for the rationale.

## Getting a session

```bash
# Register creates the organization, its OWNER membership, and a session
curl -c jar -X POST http://localhost:3000/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"me@example.com","password":"password123",
       "name":"Me","organizationName":"My Company"}'

# Or log in
curl -c jar -X POST http://localhost:3000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"me@example.com","password":"password123"}'
```

Both respond `201`/`200` and set a `session` cookie. The cookie is
`httpOnly`, `sameSite=lax`, `secure` in production, and expires after
`SESSION_MAX_AGE_DAYS` (default 30).

Non-browser clients can send the same token as a bearer:

```
Authorization: Bearer <session-token>
```

The cookie takes precedence when both are present.

## Using the session

Every authenticated request exposes an identity to handlers, and the session
defines the tenant:

```ts
request.auth = {
  userId: 'user_...',
  organizationId: 'org_...',
  sessionId: 'sess_...',
}
```

Queries are scoped to `request.auth.organizationId`. A client cannot select a
different organization by changing the request body — the organization comes
from the session, never from user input.

## Roles

Membership roles are checked per request by
`Authorizer.requireRole('OWNER', 'ADMIN')`.

| Role | Read | Write (create/update/delete, qualify, convert, advance, win/lose) |
| --- | --- | --- |
| `OWNER` | yes | yes |
| `ADMIN` | yes | yes |
| `MEMBER` | yes | no — `403 FORBIDDEN` |

A user with no membership in the organization gets `403`, not `404`.

## Endpoint reference

| Method | Path | Auth | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register` | none | `201` | `409` duplicate email, `422` |
| `POST` | `/api/v1/auth/login` | none | `200` | `401`, `422` |
| `POST` | `/api/v1/auth/password/change` | session | `200` | `401` wrong current password, `422` |
| `POST` | `/api/v1/auth/logout` | session | `204` | `401` |
| `GET` | `/api/v1/auth/me` | session | `200` | `401` |

`POST /api/v1/auth/password/change` revokes every session except the one used
to make the request.

## Failure modes

| Status | Code | Meaning |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Missing, invalid, expired, or revoked session |
| `403` | `FORBIDDEN` | Valid session, insufficient role |
| `409` | `CONFLICT` | Email already registered |
| `422` | `VALIDATION_ERROR` | Body failed validation |
