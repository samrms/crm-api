import type { Kysely } from 'kysely'

/**
 * Authentication moved from server-side sessions to stateless JWTs (ADR 003).
 * A signed token carries identity, organization, and role, so authentication
 * and authorization no longer read the database and the sessions table has no
 * reader or writer left.
 *
 * The creating migration stays in place: applied migrations are immutable
 * (ADR 005).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('sessions').ifExists().execute()
}

/**
 * Intentionally empty: restoring the table would not restore the session
 * logic that used it. Rolling this back does not make the old auth flow work.
 */
export async function down(_db: Kysely<unknown>): Promise<void> {}
