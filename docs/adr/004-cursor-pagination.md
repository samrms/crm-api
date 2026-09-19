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
