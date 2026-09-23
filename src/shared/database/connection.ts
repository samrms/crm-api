import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import { config } from '@/shared/config.js'
import { logger } from '@/shared/logging/logger.js'
import type { Database as AppDatabase } from './types.js'

const { Pool } = pg

let pool: pg.Pool | null = null
let db: Kysely<AppDatabase> | null = null
let testDb: Kysely<AppDatabase> | null = null

function isSqlite(url: string): boolean {
  return (
    url.startsWith('sqlite://') ||
    url.startsWith('sqlite:') ||
    url.includes(':memory:') ||
    url.includes('.db') ||
    url.includes('.sqlite')
  )
}

export function setTestDb(database: Kysely<AppDatabase> | null) {
  testDb = database
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

export function getDb(): Kysely<AppDatabase> {
  if (testDb) return testDb
  if (db) return db
  if (isSqlite(config.databaseUrl)) {
    throw new Error(
      'SQLite DATABASE_URL is only supported in tests. Use testDatabase.ts for tests or Postgres for server.',
    )
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
