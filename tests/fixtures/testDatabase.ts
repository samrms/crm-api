import { Kysely, SqliteDialect } from 'kysely'
import { DatabaseSync } from 'node:sqlite'
import type { Database as AppDatabase } from '../../src/shared/database/types.js'
import { setTestDb } from '../../src/shared/database/connection.js'

let db: Kysely<AppDatabase> | null = null

function toSqliteParam(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString()
  if (
    v !== null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    !(v instanceof Uint8Array)
  ) {
    return JSON.stringify(v)
  }
  return v
}

const DATE_LIKE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/

function reviveDates<T>(row: T): T {
  if (row && typeof row === 'object') {
    const record = row as Record<string, unknown>
    for (const key of Object.keys(record)) {
      const value = record[key]
      if (typeof value === 'string' && DATE_LIKE.test(value)) {
        record[key] = new Date(value)
      }
    }
  }
  return row
}

function wrapNodeSqlite(path: string) {
  const sqlite = new DatabaseSync(path)
  return {
    prepare: (sql: string) => {
      const isReader =
        /^\s*select/i.test(sql) || sql.toLowerCase().includes('returning')
      const stmt = sqlite.prepare(sql)
      return {
        reader: isReader,
        run: (...params: unknown[]) => {
          const p = (
            params.length === 1 && Array.isArray(params[0])
              ? (params[0] as unknown[])
              : params
          ).map(toSqliteParam)
          return stmt.run(...(p as unknown[]))
        },
        get: (...params: unknown[]) => {
          const p = (
            params.length === 1 && Array.isArray(params[0])
              ? (params[0] as unknown[])
              : params
          ).map(toSqliteParam)
          const row = stmt.get(...(p as unknown[]))
          return row === undefined ? undefined : reviveDates(row)
        },
        all: (...params: unknown[]) => {
          const p = (
            params.length === 1 && Array.isArray(params[0])
              ? (params[0] as unknown[])
              : params
          ).map(toSqliteParam)
          return stmt.all(...(p as unknown[])).map((row) => reviveDates(row))
        },
      }
    },
    exec: (sql: string) => sqlite.exec(sql),
    close: () => sqlite.close(),
  }
}

export async function startTestDatabase(): Promise<Kysely<AppDatabase>> {
  if (db) return db
  db = new Kysely<AppDatabase>({
    dialect: new SqliteDialect({
      database: wrapNodeSqlite(':memory:') as never,
    }),
  })
  setTestDb(db)
  const { migrateUp } = await import('../../src/shared/database/migrate.js')
  await migrateUp(db)
  return db
}

export async function stopTestDatabase(): Promise<void> {
  if (db) {
    await db.destroy()
    db = null
  }
  setTestDb(null)
}

export function getTestDb(): Kysely<AppDatabase> {
  if (!db)
    throw new Error(
      'Test database not started. Call startTestDatabase() first.',
    )
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
  const database = getTestDb()
  for (const table of TABLES) {
    try {
      await database.deleteFrom(table as never).execute()
    } catch (_e) {
      void _e
    }
  }
}
