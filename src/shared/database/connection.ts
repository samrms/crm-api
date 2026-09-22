import { Kysely, PostgresDialect, SqliteDialect } from 'kysely'
import pg from 'pg'
import SqliteDatabaseSqliteDatabaseSqliteDatabaseSqliteDatabaseSqliteDatabaseSqliteDatabaseSqliteDatabaseSqliteDatabaseSqliteDatabase from 'better-sqlite3'
import { config } from '@/shared/config.js'
import { logger } from '@/shared/logging/logger.js'
import type { Database } from './types.js'

const { Pool } = pg

let pool: pg.Pool | null = null
let db: Kysely<Database> | null = null

function isSqlite(url: string): boolean {
  return (
    url.startsWith('sqlite://') ||
    url.startsWith('sqlite:') ||
    url.includes(':memory:') ||
    url.includes('.db') ||
    url.includes('.sqlite')
  )
}

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })
    pool.on('error', (err) => logger.error({ err }, 'DB pool error'))
  }
  return pool
}

export function getDb(): Kysely<Database> {
  if (!db) {
    if (isSqlite(config.databaseUrl)) {
      db = new Kysely<Database>({
        dialect: new SqliteDialect({
          database:
            new SqliteDatabaseSqliteDatabaseSqliteDatabaseSqliteDatabaseSqliteDatabaseSqliteDatabaseSqliteDatabaseSqliteDatabaseSqliteDatabase(
              config.databaseUrl.replace('sqlite://', '') || ':memory:',
            ),
        }),
      })
      logger.info('DB: SQLite mode (in-memory/file)')
    } else {
      db = new Kysely<Database>({
        dialect: new PostgresDialect({ pool: getPool() }),
      })
      logger.info('DB: PostgreSQL mode')
    }
  }
  return db
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.destroy()
    db = null
  }
  if (pool) {
    await pool.end()
    pool = null
  }
}
