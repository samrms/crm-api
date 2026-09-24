import type { Kysely } from 'kysely'

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

/**
 * Intentionally empty. Recreating these tables by hand would drift from the
 * originals (indexes, defaults, constraints) and misrepresent the schema. If
 * they are ever needed again, that is a new, explicit migration — not a
 * rollback of this one.
 */
export async function down(_db: Kysely<unknown>): Promise<void> {}
