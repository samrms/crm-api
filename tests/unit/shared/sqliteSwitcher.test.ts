import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isSqliteUrl,
  sqlitePathFromUrl,
} from '../../../src/shared/database/sqlite.ts'
import { sql } from 'kysely'

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL

async function importFresh(databaseUrl: string) {
  vi.resetModules()
  process.env.DATABASE_URL = databaseUrl
  const { database } =
    await import('../../../src/shared/database/connection.ts')
  const { DatabaseMigrator } =
    await import('../../../src/shared/database/migrate.ts')
  return { database, DatabaseMigrator }
}

afterEach(() => {
  vi.resetModules()
  if (ORIGINAL_DATABASE_URL === undefined) {
    delete process.env.DATABASE_URL
  } else {
    process.env.DATABASE_URL = ORIGINAL_DATABASE_URL
  }
})

describe('DATABASE_URL switcher', () => {
  it('detects sqlite urls', () => {
    expect(isSqliteUrl('sqlite://')).toBe(true)
    expect(isSqliteUrl('sqlite://./dev.db')).toBe(true)
    expect(isSqliteUrl(':memory:')).toBe(true)
    expect(isSqliteUrl('postgres://user@localhost:5432/crm')).toBe(false)
    expect(isSqliteUrl('postgresql://localhost/crm')).toBe(false)
  })

  it('maps urls to sqlite paths', () => {
    expect(sqlitePathFromUrl('sqlite://')).toBe(':memory:')
    expect(sqlitePathFromUrl('sqlite::memory:')).toBe(':memory:')
    expect(sqlitePathFromUrl('sqlite://./dev.db')).toBe('./dev.db')
    expect(sqlitePathFromUrl('file:./dev.db')).toBe('./dev.db')
  })

  it('builds an in-memory sqlite database, runs migrations and round-trips dates', async () => {
    const { database, DatabaseMigrator } = await importFresh('sqlite://')
    try {
      const db = database.db
      const probe = await sql<{ x: number }>`select 1 as x`.execute(db)
      expect(probe.rows).toHaveLength(1)

      await new DatabaseMigrator(db).up()
      const latest = await sql<{
        name: string
      }>`select name from kysely_migrations
        order by timestamp desc limit 1`.execute(db)
      expect(latest.rows[0]?.name).toBe('015_create_password_reset_tokens')

      const now = new Date()
      await db
        .insertInto('organizations')
        .values({
          id: 'org_switcher',
          name: 'Switcher Org',
          slug: 'switcher-org',
          created_at: now,
          updated_at: now,
        })
        .execute()
      const row = await db
        .selectFrom('organizations')
        .selectAll()
        .where('id', '=', 'org_switcher')
        .executeTakeFirstOrThrow()
      expect(row.name).toBe('Switcher Org')
      expect(row.created_at).toBeInstanceOf(Date)
    } finally {
      await database.close()
    }
  })

  it('keeps postgres urls on a pg pool without connecting', async () => {
    const { database } = await importFresh(
      'postgres://postgres@localhost:5432/crm',
    )
    try {
      expect(() => database.pool).not.toThrow()
    } finally {
      await database.close()
    }
  })

  it('refuses getPool() in sqlite mode', async () => {
    const { database } = await importFresh('sqlite://')
    try {
      expect(() => database.pool).toThrow(/SQLite/)
    } finally {
      await database.close()
    }
  })
})
