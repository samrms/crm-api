# Threat model

Scope: the CRM API — HTTP surface, session handling, tenant isolation, and
data at rest in PostgreSQL. Assumes a correctly configured TLS-terminating
proxy in front of the process; transport security itself is the platform's
responsibility.

## Assets

| Asset | Why it matters |
| --- | --- |
| Customer data (companies, contacts) | personal data; disclosure is a compliance event |
| Pipeline data (leads, deals, values) | business-confidential |
| Credentials | password hashes and live session tokens |
| Tenant boundary | the core invariant: one organization must never observe another |
| Availability | the API is a sales system; import/export and CRM reads are daily-use |

## Trust boundaries

1. **Internet → Fastify.** Everything from the client is untrusted: headers,
   cookies, bodies, query and path parameters, `X-Forwarded-For`.
2. **Fastify → service layer.** The service layer trusts the session-derived
   identity (`request.auth`) and nothing about the payload.
3. **Service → PostgreSQL.** Queries are built with bound parameters through
   Kysely; the database is trusted for integrity, and relied on to enforce
   uniqueness and foreign keys.
4. **Process → Redis.** Redis holds cache and readiness state only. Losing it
   degrades `/ready`; it must never be a source of truth.

## Threats and mitigations

| Threat | Mitigation |
| --- | --- |
| **Cross-tenant read/write (IDOR)** | every repository method takes `organizationId` from the session; access to another tenant's row returns `404`. Regression-tested in the security suite. |
| **Privilege escalation** | `requireRole` re-reads the membership on each request; a `MEMBER` cannot reach a write handler. |
| **Session theft via XSS** | cookie is `httpOnly`, so page scripts cannot read it; `sameSite=lax` limits cross-site sends; CSP and `X-Content-Type-Options` come from helmet. |
| **Session fixation** | a fresh token is generated per login; registering a new password rotates trust by revoking other sessions. |
| **Password guessing** | argon2id with per-password salt; generic login errors prevent account enumeration; global rate limiting caps attempts per IP. |
| **SQL injection** | every query is a parameterized Kysely builder; no query is assembled from user input. Injection payloads in ids and filters are treated as literals. |
| **Mass assignment** | handlers map explicit input objects to service calls; unknown fields (`organization_id`, `role`, `deleted_at`) are dropped. Covered by tests. |
| **CSRF** | state-changing routes require a cookie-authenticated session and are protected by `sameSite=lax` plus a single-origin CORS policy; non-cookie clients use bearer tokens, which are not attached automatically by browsers. |
| **Resource exhaustion** | bounded page size (max 100), capped import payload, rate limiting, bounded pagination cursors. |
| **Information disclosure via errors** | one error envelope, no stacks, generic `500`; unexpected errors are logged with a request id instead of being returned. |
| **Secret leakage in images or logs** | `.dockerignore` excludes `.env` and `.git`; platform-injected URLs; logs carry pino fields, not connection strings. |
| **Stale/stolen session after compromise** | `revokeAllExceptSession` on password change; every logout invalidates immediately. |
| **Denial of service via DB exhaustion** | one connection pool, bounded per request; `trustProxy` keeps rate limiting meaningful behind a proxy. |

## Out of scope

- Availability of the platform (Render), TLS termination, and DDoS protection.
- Physical security of the host or of the database backups.
- Client-side (browser) security, beyond the headers the API sets.
- Business-logic abuse such as scraping the catalog at volume; rate limiting
  raises the cost but does not eliminate it.

## Review triggers

Revisit this model when: a new write path is added without `requireRole`; a
query is introduced outside a repository; a second tenant-facing surface
(worker, webhook, admin CLI) appears; or file storage moves from local disk to
object storage.
