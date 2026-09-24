import { Kysely, PostgresDialect, SqliteDialect } from 'kysely'
import pg from 'pg'
import { config } from '@/shared/config.js'
import { logger } from '@/shared/logging/logger.js'
import { isSqliteUrl, openSqliteDatabase } from './sqlite.js'
import type { Database as AppDatabase } from './types.js'

const { Pool } = pg

export class DatabaseManager {
  private pgPool: pg.Pool | null = null
  private kyselyDb: Kysely<AppDatabase> | null = null
  private testDb: Kysely<AppDatabase> | null = null

  setTestDb(database: Kysely<AppDatabase> | null): void {
    this.testDb = database
  }

  get db(): Kysely<AppDatabase> {
    if (this.testDb) return this.testDb
    if (this.kyselyDb) return this.kyselyDb
    if (isSqliteUrl(config.databaseUrl)) {
      this.kyselyDb = new Kysely<AppDatabase>({
        dialect: new SqliteDialect({
          database: openSqliteDatabase(config.databaseUrl),
        }),
      })
      logger.info('DB: SQLite mode (in-memory)')
      return this.kyselyDb
    }
    this.kyselyDb = new Kysely<AppDatabase>({
      dialect: new PostgresDialect({ pool: this.pool }),
    })
    logger.info('DB: PostgreSQL mode')
    return this.kyselyDb
  }

  get pool(): pg.Pool {
    if (isSqliteUrl(config.databaseUrl)) {
      throw new Error(
        'Database pool is unavailable: DATABASE_URL is SQLite (in-memory mode).',
      )
    }
    if (!this.pgPool) {
      this.pgPool = new Pool({
        connectionString: config.databaseUrl,
        max: 20,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      })
      this.pgPool.on('error', (err) => logger.error({ err }, 'DB pool error'))
    }
    return this.pgPool
  }

  async close(): Promise<void> {
    this.testDb = null
    const closingDb = this.kyselyDb
    const closingPool = this.pgPool
    this.kyselyDb = null
    this.pgPool = null
    if (closingDb) {
      await closingDb.destroy()
    } else if (closingPool) {
      await closingPool.end()
    }
  }
}

export const database = new DatabaseManager()
