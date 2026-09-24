import { Kysely, PostgresDialect, SqliteDialect } from 'kysely'
import pg from 'pg'
import { config } from '@/shared/config.js'
import { logger } from '@/shared/logging/logger.js'
import { isSqliteUrl, openSqliteDatabase } from './sqlite.js'
import type { Database as AppDatabase } from './types.js'

const { Pool } = pg

let pool: pg.Pool | null = null
let db: Kysely<AppDatabase> | null = null
let testDb: Kysely<AppDatabase> | null = null

export function setTestDb(database: Kysely<AppDatabase> | null) {
  testDb = database
}

export function getPool(): pg.Pool {
  if (isSqliteUrl(config.databaseUrl)) {
    throw new Error(
      'getPool() is unavailable: DATABASE_URL is SQLite (in-memory mode).',
    )
  }
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

export function getDb(): Kysely<AppDatabase> {
  if (testDb) return testDb
  if (db) return db
  if (isSqliteUrl(config.databaseUrl)) {
    db = new Kysely<AppDatabase>({
      dialect: new SqliteDialect({
        database: openSqliteDatabase(config.databaseUrl),
      }),
    })
    logger.info('DB: SQLite mode (in-memory)')
    return db
  }
  db = new Kysely<AppDatabase>({
    dialect: new PostgresDialect({ pool: getPool() }),
  })
  logger.info('DB: PostgreSQL mode')
  return db
}

export async function closeDatabase(): Promise<void> {
  if (testDb) testDb = null
  const closingDb = db
  const closingPool = pool
  db = null
  pool = null
  if (closingDb) {
    await closingDb.destroy()
  } else if (closingPool) {
    await closingPool.end()
  }
}
