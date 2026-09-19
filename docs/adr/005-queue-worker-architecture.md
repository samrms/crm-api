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
