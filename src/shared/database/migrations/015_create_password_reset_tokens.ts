import type { Kysely } from 'kysely'

/**
 * Password reset was retired, but this migration is recorded as executed in
 * databases that ran the feature. Kysely refuses to start when a previously
 * executed migration file disappears, so the entry stays as a no-op: existing
 * databases keep their (now unused) table, fresh ones never create it.
 */
export async function up(_db: Kysely<unknown>): Promise<void> {}

export async function down(_db: Kysely<unknown>): Promise<void> {}
