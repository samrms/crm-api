# ADR 004: The import/export pipeline is accepted but not processed

- **Status:** Accepted (feature gap, documented)
- **Date:** 2026-09-23

## Context

Import and export endpoints accept a job and return `202 Accepted` with a job
id. The original design queued work through an outbox table plus BullMQ and
ran it in a separate worker.

That worker never existed. The outbox rows were written and never read, the
BullMQ queue and relay had no callers, and `docker-compose.yml` referenced a
`dist/worker.js` that was never built. Roughly 850 lines of unreachable code
shipped in the repository, and a job id was the only trace of work that never
ran.

## Decision

Delete the pipeline rather than ship a half-wired one.

Removed: `src/shared/queue/` (BullMQ queue and outbox relay),
`processImport`, `processExport`, and the `publishOutboxEvent` writer. The
`outbox_events` table and its migration stay so existing databases keep their
history and migration numbering does not shift.

`ImportService.createImport` and `ExportService.createExport` now do what they
say: create a `PENDING` job row and return it.

## Consequences

- **Honest behavior:** an import stays `PENDING` forever until a processor
  exists. The API contract says `202 Accepted`, which is accurate — the request
  was accepted and is queryable at `GET /api/v1/imports/{id}`. It is not yet
  processed, and this document is the place that says so.
- If asynchronous processing is reintroduced, it should arrive as a feature:
  a real worker process, a real queue, a retry policy, and status transitions
  driven by the worker. Do not resurrect the deleted code as a starting point.
- No compose service or Render worker is defined today, because none exists.
