# API conventions

Every response in this API follows the same shapes. The OpenAPI document in
[`openapi.md`](./openapi.md) is generated from the same source of truth as the
implementation, so these rules are enforced in code and documented, not
documented and hoped for.

## Success envelope

Single resource:

```json
{ "data": { "id": "co_...", "name": "Acme" } }
```

Cursor-paginated list:

```json
{
  "data": [ /* … */ ],
  "pagination": { "limit": 25, "hasNextPage": true, "nextCursor": "eyJ…" }
}
```

`202 Accepted` jobs (`POST /imports`, `POST /exports`) return the accepted
resource under `data`, and the client polls `GET /imports/{id}` or
`GET /exports/{id}`. See [ADR 004](../adr/004-retired-async-pipeline.md) for
what "accepted" means today.

`204 No Content` is used for deletes and logout. There is no body.

## Error envelope

Every error — validation, auth, not found, conflict, rate limit, unhandled —
uses one shape:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Company with id co_missing not found",
    "requestId": "req_0f8c…",
    "details": {}
  }
}
```

`details` is present only for validation errors. The `requestId` matches the
`X-Request-Id` response header, so a user-reported failure can be traced to a
log line.

### Error codes

| Code | Status | Source |
| --- | --- | --- |
| `VALIDATION_ERROR` | `422` | zod parse failure in the handler, or a business-rule violation |
| `UNAUTHORIZED` | `401` | missing/invalid/expired/revoked session |
| `FORBIDDEN` | `403` | role check failed |
| `NOT_FOUND` | `404` | resource absent in the caller's organization |
| `CONFLICT` | `409` | duplicate registration, invalid state transition, resource not ready |
| `OPTIMISTIC_LOCK_CONFLICT` | `409` | the row changed between read and write; retry |
| `RATE_LIMITED` | `429` | request budget exhausted |
| `INTERNAL_ERROR` | `500` | unhandled exception; message is generic, details stay in the log |

Cross-tenant access returns `404`, not `403`: a tenant must not be able to
probe for the existence of another tenant's resources.

## Pagination

Lists are cursor-based. Pass `?limit=` (1–100, default 25) and `?after=` with
the `pagination.nextCursor` value from the previous page. Cursors are
HMAC-signed with `SESSION_SECRET`; a tampered or stale cursor is
`400 INVALID_CURSOR`. The server never uses `OFFSET`, so page cost does not
grow with table size.

## Validation

Request bodies are validated by zod inside the handler, not by Fastify's
built-in validator (which is a no-op here). This keeps the rules next to the
service call that depends on them. Validation failures are `422`.

## Status codes

| Code | Meaning here |
| --- | --- |
| `200` | read or update succeeded |
| `201` | resource created, or a lead was converted |
| `202` | job accepted for processing |
| `204` | deleted, or logged out |
| `400` | malformed request, bad cursor |
| `401` / `403` | not authenticated / not permitted |
| `404` | not found in this organization |
| `409` | state conflict, or optimistic-lock failure |
| `422` | body validation failed |
| `429` | rate limited |
| `500` | unhandled server error |

## Request tracing

Send `X-Request-Id` to propagate your own id; otherwise the server generates
`req_<uuid>`. The id is returned on every response and included in every error
body.
