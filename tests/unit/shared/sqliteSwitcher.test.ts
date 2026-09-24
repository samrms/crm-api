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
  const connection = await import('../../../src/shared/database/connection.ts')
  const { migrateUp } = await import('../../../src/shared/database/migrate.ts')
  return { ...connection, migrateUp }
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
    const { getDb, closeDatabase, migrateUp } = await importFresh('sqlite://')
    try {
      const db = getDb()
      const probe = await sql<{ x: number }>`select 1 as x`.execute(db)
      expect(probe.rows).toHaveLength(1)

      await migrateUp()
      const [{ count }] = (
        await sql<{ count: number }>`select count(*) as count
        from kysely_migrations`.execute(db)
      ).rows
      expect(Number(count)).toBe(14)

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
      await closeDatabase()
    }
  })

  it('keeps postgres urls on a pg pool without connecting', async () => {
    const { getPool, closeDatabase } = await importFresh(
      'postgres://postgres@localhost:5432/crm',
    )
    try {
      expect(() => getPool()).not.toThrow()
    } finally {
      await closeDatabase()
    }
  })

  it('refuses getPool() in sqlite mode', async () => {
    const { getPool, closeDatabase } = await importFresh('sqlite://')
    try {
      expect(() => getPool()).toThrow(/SQLite/)
    } finally {
      await closeDatabase()
    }
  })
})
