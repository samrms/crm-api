import { Kysely, SqliteDialect } from 'kysely'
import { database } from '../../src/shared/database/connection.js'
import { openSqliteDatabase } from '../../src/shared/database/sqlite.js'
import { DatabaseMigrator } from '../../src/shared/database/migrate.js'
import type { Database as AppDatabase } from '../../src/shared/database/types.js'

let db: Kysely<AppDatabase> | null = null

export async function startTestDatabase(): Promise<Kysely<AppDatabase>> {
  if (db) return db
  db = new Kysely<AppDatabase>({
    dialect: new SqliteDialect({ database: openSqliteDatabase(':memory:') }),
  })
  database.setTestDb(db)
  await new DatabaseMigrator(db).up()
  return db
}

export async function stopTestDatabase(): Promise<void> {
  if (db) {
    await db.destroy()
    db = null
  }
  database.setTestDb(null)
}

export function getTestDb(): Kysely<AppDatabase> {
  if (!db) throw new Error('Test database not started.')
  return db
}

const TABLES = [
  'audit_events',
  'outbox_events',
  'imports',
  'exports',
  'activities',
  'tasks',
  'deals',
  'leads',
  'contacts',
  'companies',
  'memberships',
  'sessions',
  'users',
  'organizations',
] as const

export async function truncateAllTables(): Promise<void> {
  const databaseInstance = getTestDb()
  for (const table of TABLES) {
    await databaseInstance.deleteFrom(table).execute()
  }
}
