import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import { config } from '../config.js'
import { logger } from '../logging/logger.js'
import type { Database } from './types.js'

const { Pool } = pg

let pool: pg.Pool | null = null

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })
    pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected database pool error')
    })
  }
  return pool
}

let db: Kysely<Database> | null = null

export function getDb(): Kysely<Database> {
  if (!db) {
    db = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: getPool(),
      }),
    })
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

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await getPool().query('SELECT 1')
    return true
  } catch {
    return false
  }
}
