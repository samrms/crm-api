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
