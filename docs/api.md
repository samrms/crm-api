# API Reference

Base path `/api/v1`, JSON in / JSON out, session cookie auth.
Interactive docs at `/docs` (Swagger UI); raw OpenAPI 3 document at `/docs/json`.
Request schemas in the document are generated from the same Zod schemas that validate requests.

## Endpoints

| Method | Path                          | Access       |
| ------ | ----------------------------- | ------------ |
| GET    | `/`                           | public (landing + links) |
| GET    | `/docs`, `/docs/json`         | public (Swagger UI, OpenAPI) |
| GET    | `/health`                     | public (liveness) |
| GET    | `/ready`                      | public (Postgres + Redis readiness, `200`/`503`) |
| POST   | `/api/v1/auth/register`       | public — creates org + owner + session |
| POST   | `/api/v1/auth/login`          | public       |
| POST   | `/api/v1/auth/logout`         | authenticated |
| GET    | `/api/v1/auth/me`             | authenticated |
| POST   | `/api/v1/auth/password-reset/request` | public — always 200 (anti-enumeration) |
| POST   | `/api/v1/auth/password-reset/confirm` | public — single-use token, revokes all sessions |
| POST   | `/api/v1/auth/password/change` | authenticated — revokes other sessions |
| GET    | `/api/v1/companies`, `/companies/:id` | authenticated |
| POST   | `/api/v1/companies`           | OWNER/ADMIN  |
| PATCH  | `/api/v1/companies/:id`       | OWNER/ADMIN  |
| DELETE | `/api/v1/companies/:id`       | OWNER/ADMIN  |
| GET    | `/api/v1/contacts`, `/contacts/:id` | authenticated |
| POST/PATCH/DELETE | `/api/v1/contacts…`   | OWNER/ADMIN  |
| GET    | `/api/v1/leads`, `/leads/:id` | authenticated |
| POST/PATCH/DELETE | `/api/v1/leads…`       | OWNER/ADMIN  |
| POST   | `/api/v1/leads/:id/qualify`   | OWNER/ADMIN  |
| POST   | `/api/v1/leads/:id/convert`   | OWNER/ADMIN  |
| GET    | `/api/v1/deals`, `/deals/:id` | authenticated |
| POST/PATCH/DELETE | `/api/v1/deals…`       | OWNER/ADMIN  |
| POST   | `/api/v1/deals/:id/advance`   | OWNER/ADMIN  |
| POST   | `/api/v1/deals/:id/win` / `lose` | OWNER/ADMIN |
| GET    | `/api/v1/tasks`, `/tasks/:id` | authenticated |
| POST/PATCH/DELETE, `/tasks/:id/complete` | OWNER/ADMIN |
| GET/POST/PATCH/DELETE | `/api/v1/members…` | OWNER/ADMIN |
| GET    | `/api/v1/organizations/:id`   | authenticated |
| PATCH  | `/api/v1/organizations/:id`   | OWNER/ADMIN  |
| POST   | `/api/v1/imports`             | OWNER/ADMIN  |
| GET    | `/api/v1/imports/:id`         | authenticated |
| POST   | `/api/v1/exports`             | OWNER/ADMIN  |
| GET    | `/api/v1/exports/:id`         | authenticated |
| GET    | `/api/v1/audit-events`, `/:id`| OWNER/ADMIN  |

## Error contract

Every failure has the same shape — machine-readable `code`, human `message`, and the `requestId`
that ties it to the logs (500s never leak stack traces):

```json
{
  "error": {
    "code": "OPTIMISTIC_LOCK_CONFLICT",
    "message": "Deal was modified by another request",
    "requestId": "req-1f2e3d"
  }
}
```

| Status | Codes                                                  |
| ------ | ------------------------------------------------------ |
| 400    | `INVALID_CURSOR`                                       |
| 401    | `UNAUTHORIZED` (missing/expired/revoked session)        |
| 403    | `FORBIDDEN` (role too low)                             |
| 404    | `NOT_FOUND` (also used for cross-tenant IDs)           |
| 409    | `CONFLICT`, `OPTIMISTIC_LOCK_CONFLICT`                 |
| 422    | `VALIDATION_ERROR` (Zod failures and illegal transitions, with `details`) |
| 429    | `RATE_LIMITED`                                         |
| 500    | `INTERNAL_ERROR`                                       |

## Pagination

Keyset (not offset) pagination on `created_at DESC, id DESC` with a signed base64url cursor —
stable under inserts, no duplicated or skipped rows. Repositories over-fetch one row so responses
can report `hasNextPage` honestly:

```http
GET /api/v1/companies?limit=25
GET /api/v1/companies?limit=25&after=<nextCursor>

{
  "data": [ ... ],
  "pagination": { "limit": 25, "hasNextPage": true, "nextCursor": "eyJjcmVhdGVkQXQiOi…" }
}
```

`limit` is capped at 100; a malformed cursor is `400 INVALID_CURSOR`. The companies list also
demonstrates a tenant-scoped filter (`?name=`, exact match, parameterized).

## HATEOAS

Responses advertise only the actions that are legal *right now*:

```json
{
  "data": {
    "id": "ld_Kx9…",
    "status": "QUALIFIED",
    "_links": {
      "self":    { "href": "/api/v1/leads/ld_Kx9…" },
      "qualify": { "href": "/api/v1/leads/ld_Kx9…/qualify" },
      "convert": { "href": "/api/v1/leads/ld_Kx9…/convert" }
    }
  }
}
```

A `CONVERTED` lead advertises neither action; a `NEGOTIATION` deal advertises `win`/`lose` but not
`advance` once terminal.

## Security

- **Passwords**: argon2id; password reset uses single-use sha256-hashed tokens (1h expiry,
  anti-enumeration); password change revokes other sessions
- **Sessions**: opaque server-side tokens in an `HttpOnly` cookie with expiry and revocation
  (logout invalidates immediately)
- **Tenant isolation**: organization scoping is enforced in the repository layer, not in handlers —
  covered by IDOR/tenant-escape tests
- **Mass assignment**: request bodies pass through Zod schemas that strip unknown keys
  (`role`, `deletedAt`, `organization_id` cannot be smuggled in)
- **SQL injection**: only parameterized Kysely queries; cursor and filter inputs are validated
- **Payload limits**: oversized request bodies are rejected before processing
- **Rate limiting**: per-IP (default 100/min → `429 RATE_LIMITED`); explicitly disabled under
  `NODE_ENV=test` except in the test that exercises it
- **Headers/hardening**: Helmet, strict CORS origin, generic 500s, request IDs on every response
