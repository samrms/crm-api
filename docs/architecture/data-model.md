# Data model

PostgreSQL in production; in-memory SQLite for development and tests
([ADR 001](../adr/001-database-per-environment.md)). The schema is defined by
the migrations in `src/shared/database/migrations/` and typed in
`src/shared/database/types.ts`.

## Core tables

```
organizations ──< memberships >── users
      │                                │
      │                                └──< sessions >──┘
      │
      ├──< companies ──< contacts
      ├──< leads
      ├──< deals
      ├──< imports
      ├──< exports
      ├──< audit_events
      ├──< outbox_events        (retired, retained; see ADR 004)
      ├──< activities           (demo data only, no API)
      └──< tasks                (demo data only, no API)
```

### Identity

| Table | Columns | Notes |
| --- | --- | --- |
| `organizations` | `id`, `name`, `slug` (unique), timestamps, `deleted_at` | the tenant |
| `users` | `id`, `email` (unique), `name`, `password_hash`, timestamps, `deleted_at` | global identity, not tenant-scoped |
| `memberships` | `id`, `user_id`, `organization_id`, `role` | unique on `(user_id, organization_id)`; `role` constrained to `OWNER\|ADMIN\|MEMBER` |
| `sessions` | `id`, `token` (unique), `user_id`, `organization_id`, `expires_at`, `revoked_at` | the active organization for that login |

A user can belong to several organizations; the session pins which one the
request operates in.

### CRM tables

| Table | Key columns | Notes |
| --- | --- | --- |
| `companies` | `name`, `domain`, `industry`, `size`, `website`, `notes` | `name` is not unique across tenants; `findByName` is scoped |
| `contacts` | `company_id`, `email`, `firstName`, `lastName`, `phone`, `title`, `notes` | `company_id` nullable |
| `leads` | `email`, `firstName`, `lastName`, `company`, `source`, `status`, `convertedDealId`, `version` | `version` drives optimistic locking |
| `deals` | `title`, `companyId`, `contactId`, `leadId`, `value`, `currency`, `stage`, `expectedCloseDate`, `version` | `currency` defaults to `USD` |

### Job tables

`imports` and `exports` track `type`, `status`
(`PENDING → PROCESSING → COMPLETED | FAILED`), counters, and `file_path`.
Nothing advances them today ([ADR 004](../adr/004-retired-async-pipeline.md)).

## Conventions

- **Ids** are prefixed, sortable strings: `org_`, `user_`, `mem_`, `sess_`,
  `co_`, `ct_`, `ld_`, `dl_`, `imp_`, `exp_` (see `src/shared/utils/id.ts`).
- **Timestamps** are `text` columns holding ISO-8601. The SQLite driver revives
  them to `Date` on read so the typed layer sees dates.
- **Soft deletes**: `deleted_at IS NULL` filters every read.
- **Optimistic locking**: `version` on `leads` and `deals`; a mismatched
  version is `409 OPTIMISTIC_LOCK_CONFLICT`.
- **Cascade deletes** on `sessions.user_id`/`organization_id` and
  `memberships.user_id`/`organization_id`.

## Migrations

Numbered, immutable, and listed explicitly in
`src/shared/database/migrate.ts`:

| # | Migration |
| --- | --- |
| 001–004 | organizations, users, memberships, sessions |
| 005–008 | companies, contacts, leads, deals |
| 009–011 | activities, tasks, audit_events |
| 012–015 | outbox_events, imports, exports, password_reset_tokens (no-op) |

Run `bun run db:migrate` to apply, `bun run db:migrate:rollback` to undo the
last one. Never delete an applied migration —
see [ADR 005](../adr/005-migration-immutability.md).
