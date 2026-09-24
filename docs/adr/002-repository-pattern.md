# ADR 002: Kysely repositories, no ORM

- **Status:** Accepted
- **Date:** 2026-09-23

## Context

The API needs cursor pagination, optimistic locking, and tenant scoping on
every query. A heavyweight ORM would add a second dialect to support, a
migration story of its own, and lazy-loading behavior that hides exactly those
three concerns.

## Decision

Kysely as a typed query builder, with hand-written repositories per entity and
services that own the rules.

- **Repositories** (`src/modules/*/infrastructure/Postgres*Repository.ts`)
  receive a `Kysely<Database>` and implement one interface per entity. Every
  read and write is scoped by `organization_id`, so tenant isolation is a
  property of the data layer, not a rule a route has to remember.
- **Services** (`src/modules/*/application/*Service.ts`) hold business rules
  and state transitions, and translate empty results into `NotFoundError` and
  version mismatches into `OptimisticLockError`.
- **Migrations** are static TypeScript modules listed in a single registry
  (`src/shared/database/migrate.ts`). No glob scanning, so the applied set is
  explicit in code review.

## Consequences

- Full type safety without a codegen step, and one query shape per language.
- Soft deletes and optimistic locking are visible in the repository, not
  implied by magic.
- Migrations must never be deleted. See
  [ADR 005](./005-migration-immutability.md).
