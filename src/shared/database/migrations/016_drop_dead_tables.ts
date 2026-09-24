import type { Kysely } from 'kysely'
import { sql } from 'kysely'

const DEAD_TABLES = [
  'tasks',
  'activities',
  'audit_events',
  'outbox_events',
  'password_reset_tokens',
] as const

/**
 * Drops tables that have no API, no service, and no writer left:
 *
 *   tasks, activities     - the engagement module was removed; only the demo
 *                           seeder still wrote to them
 *   audit_events          - only ConvertLead wrote to it, and nothing read it
 *   outbox_events         - the async pipeline was removed (ADR 004): the table
 *                           was written but never read
 *   password_reset_tokens - the feature was retired (ADR 005)
 *
 * The migrations that created these tables stay in place: applied migrations
 * are immutable (ADR 005).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  for (const table of DEAD_TABLES) {
    await db.schema.dropTable(table).ifExists().execute()
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Only the shape needed to keep the rollback honest. This is a safety
  // net for an accidental `db:reset`; the tables are unused either way.
  await sql`
    create table if not exists tasks (
      id varchar(21) primary key,
      organization_id varchar(21) not null references organizations(id) on delete cascade,
      dealId varchar(21),
      leadId varchar(21),
      contactId varchar(21),
      companyId varchar(21),
      title varchar(255) not null,
      description text,
      status varchar(20) not null default 'PENDING',
      dueDate text,
      assignedToId varchar(21),
      created_at text not null default 'CURRENT_TIMESTAMP',
      updated_at text not null default 'CURRENT_TIMESTAMP',
      deleted_at text
    )
  `.execute(db)
}
