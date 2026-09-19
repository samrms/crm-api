# ADR-001: Modular Monolith Architecture

## Context

We need to decide on the overall architecture for the CRM API. The options are:

- Microservices (separate deployables for each domain)
- Modular monolith (single deployable with clear module boundaries)
- Layered monolith (traditional 3-tier with less isolation)

## Decision

We choose a **modular monolith** architecture.

Key characteristics:

- Single Node.js process for the HTTP API
- Separate Worker process for async jobs (shares codebase)
- Clear module boundaries: `organizations`, `users`, `companies`, `contacts`, `leads`, `deals`, `activities`, `tasks`, `imports`, `exports`, `audit`
- Each module has its own domain/application/infrastructure/http layers
- Shared infrastructure: database, cache, queue, auth, errors
- No barrel files — explicit imports show the dependency graph

## Alternatives Considered

### Microservices

- **Pros**: Independent scaling, technology diversity, team autonomy
- **Cons**: Operational complexity, distributed system problems, network latency, eventual consistency challenges, testing complexity

### Layered Monolith

- **Pros**: Simple, familiar
- **Cons**: Tends to become a "big ball of mud" without strong module boundaries

## Consequences

**Positive:**

- Simpler deployment (2 services: API + Worker)
- Transactional consistency within a request
- Clear module boundaries prevent coupling
- Easy to extract services later if needed
- Single database simplifies queries and transactions

**Negative:**

- All modules share the same database (though schema is separated by prefix)
- Single process means one module's crash affects all (mitigated by Worker separation)
- Scaling is all-or-nothing (but CPU/memory limits are high for typical CRM loads)

---

# ADR-002: PostgreSQL as Primary Data Store

## Context

Need a reliable, ACID-compliant database for the CRM domain data.

## Decision

Use **PostgreSQL 16+** with **Kysely** as a type-safe query builder.

Key decisions:

- Foreign keys for all relationships
- Unique constraints for business invariants (email, slug, membership)
- Check constraints for enum-like fields (status, role, stage)
- Soft deletes (`deleted_at`) only where needed
- Optimistic concurrency via `version` column on mutable entities
- Timestamps on all tables
- Indexes on foreign keys and common query paths

## Alternatives Considered

### ORM (Prisma, TypeORM, Drizzle)

- **Pros**: Less SQL, migrations included
- **Cons**: Abstraction leaks, performance surprises, learning curve, type complexity

### Raw pg + manual SQL

- **Pros**: Full control
- **Cons**: No type safety, easy to make SQL injection mistakes

### Kysely

- **Pros**: Type-safe SQL, no runtime overhead, close to SQL, migrations built-in
- **Cons**: More verbose than ORM for simple CRUD, learning curve for complex queries

## Consequences

**Positive:**

- Type-safe queries catch schema drift at compile time
- Migration system integrated
- No hidden N+1 queries
- Easy to optimize with raw SQL when needed

**Negative:**

- More verbose than ORM for simple CRUD
- Schema changes require migration files

---

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

---

# ADR-004: Cursor Pagination

## Context

Need to paginate list endpoints efficiently and reliably.

## Decision

**Cursor-based pagination with signed, opaque cursors.**

Implementation:

- Cursor = base64url({ createdAt, id }) + HMAC signature
- Deterministic ordering: `ORDER BY created_at DESC, id DESC`
- Default limit: 25, max: 100
- Cursors are opaque to clients
- Tampered/incompatible cursors rejected with 400

## Alternatives Considered

### Offset pagination

- **Pros**: Simple, allows random page access
- **Cons**: Performance degrades with large offsets, inconsistent results with concurrent writes

### Keyset pagination (raw)

- **Pros**: Efficient
- **Cons**: Cursors expose internal structure, client can tamper

### Page-based with stable sort

- **Pros**: Familiar UX
- **Cons**: Same performance issues as offset at scale

## Consequences

**Positive:**

- Consistent performance regardless of page depth
- No skipped/duplicate items from concurrent writes
- Tamper-proof cursors
- Works well with infinite scroll UIs

**Negative:**

- Cannot jump to arbitrary page (no page numbers)
- Cursor must be preserved from previous response
- Slightly more complex implementation

---

# ADR-005: Queue and Worker Architecture

## Context

Async operations (imports, exports, AI) need reliable background processing.

## Decision

**BullMQ on Redis for queue execution; PostgreSQL for durable job state.**

Architecture:

```
HTTP Request
  → Create job record in PostgreSQL (PENDING)
  → Write outbox event
  → Dispatcher publishes to BullMQ
  → Worker picks up, processes, updates PostgreSQL
  → Mark job COMPLETED/FAILED
```

Job states: `PENDING` → `PROCESSING` → `RETRYING` → `COMPLETED` | `FAILED` | `CANCELLED`

Retry: exponential backoff (1s, 2s, 4s...) + jitter, max 3 attempts.

## Alternatives Considered

### Pure PostgreSQL queue (pg-boss, SKIP LOCKED)

- **Pros**: No Redis dependency
- **Cons**: Polling overhead, no built-in retry/backoff, less mature

### RabbitMQ / Kafka

- **Pros**: Enterprise features, durability guarantees
- **Cons**: Overkill for this scale, additional infrastructure

### In-process async (setTimeout, worker_threads)

- **Pros**: No external queue
- **Cons**: Lost on crash, no persistence, no horizontal scaling

## Consequences

**Positive:**

- Redis handles delivery, retries, scheduling
- PostgreSQL is source of truth for job state
- Workers can scale horizontally
- Idempotency handled at application level

**Negative:**

- Two infrastructure dependencies (PostgreSQL + Redis)
- Eventual consistency between queue and job record
- Need dispatcher for outbox → queue

---

# ADR-006: Transactional Outbox Pattern

## Context

Business transactions must reliably trigger async work (audit, notifications, AI).

## Decision

**Transactional outbox:** write events to `outbox_events` table in the same transaction as business data.

Flow:

```
BEGIN
  Business changes (lead conversion, deal creation, etc.)
  INSERT INTO audit_events ...
  INSERT INTO outbox_events (type, payload) ...
COMMIT

Background dispatcher:
  SELECT * FROM outbox_events WHERE processed_at IS NULL
  PUBLISH to BullMQ
  UPDATE outbox_events SET processed_at = NOW()
```

## Alternatives Considered

### Dual write (DB + Queue)

- **Pros**: Simple
- **Cons**: Race condition — DB commits, queue publish fails → data inconsistency

### Event sourcing

- **Pros**: Complete audit trail, temporal queries
- **Cons**: Complexity, learning curve, overkill for this domain

### CDC (Change Data Capture)

- **Pros**: No application changes
- **Cons**: Infrastructure complexity, schema coupling, operational burden

## Consequences

**Positive:**

- Atomic: business data + outbox event committed together
- No lost events
- Dispatcher can retry indefinitely
- Simple to understand and debug

**Negative:**

- Polling overhead (mitigated by index on `processed_at`)
- Eventual delivery (seconds delay)

---

# ADR-007: Optimistic Concurrency Control

## Context

Prevent lost updates when multiple users edit the same resource.

## Decision

**Version column (`integer`) on mutable entities (leads, deals).**

Implementation:

```
UPDATE deals
SET stage = $1, version = version + 1, updated_at = NOW()
WHERE id = $2 AND organization_id = $3 AND version = $4
```

- If 0 rows affected → 409 Conflict
- Client re-fetches and retries

## Alternatives Considered

### Pessimistic locking (SELECT FOR UPDATE)

- **Pros**: Guarantees no conflicts
- **Cons**: Longer lock holding, deadlock risk, reduces throughput

### Last-write-wins (no version)

- **Pros**: Simple
- **Cons**: Silent data loss — unacceptable for CRM

### ETags (HTTP-level)

- **Pros**: Standard, cacheable
- **Cons**: Only works for full-resource updates, not partial

## Consequences

**Positive:**

- No lost updates
- Low contention (no long locks)
- Clear error for client (409 Conflict)
- Works with any update pattern

**Negative:**

- Client must handle 409 and retry
- Slight storage overhead (version column)

---

# ADR-008: AI Integration Boundary

## Context

Add AI features (e.g., deal summary) without compromising security or reliability.

## Decision

**Isolated AI service with strict boundaries.**

Architecture:

```
Application use case
  → AI Service Interface
  → Provider Implementation (OpenAI)
  → Structured output (JSON schema)
  → Zod validation
  → Business rule validation
  → Persist
```

Constraints:

- AI never executes SQL or commands
- AI never changes permissions/membership
- Input: sanitized, limited context (no passwords, tokens, cross-org data)
- Output: validated before use
- Rate-limited per organization
- Audited

## Alternatives Considered

### AI as microservice

- **Pros**: Isolation
- **Cons**: Overhead for single feature

### LangChain / Agents

- **Pros**: Powerful abstractions
- **Cons**: Complexity, prompt injection surface, hard to audit

### Direct OpenAI calls in controllers

- **Pros**: Simple
- **Cons**: No validation, security risk, hard to test

## Consequences

**Positive:**

- Clear security boundary
- Testable with mock provider
- Provider swappable
- Failures don't crash CRM operations

**Negative:**

- More code than direct call
- Limited to well-defined use cases
- Additional latency
