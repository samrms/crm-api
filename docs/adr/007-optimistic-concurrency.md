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
