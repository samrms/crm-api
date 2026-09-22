import type { StartedTestContainer } from 'testcontainers'
import { GenericContainer, Wait } from 'testcontainers'
import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import type { Database } from '../../src/shared/database/types.js'

let container: StartedTestContainer | null = null
let db: Kysely<Database> | null = null

export async function startTestDatabase(): Promise<Kysely<Database>> {
  if (db) return db

  container = await new GenericContainer('postgres:16-alpine')
    .withEnvironment({
      POSTGRES_USER: 'postgres',
      POSTGRES_PASSWORD: 'postgres',
      POSTGRES_DB: 'crm_test',
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forListeningPorts())
    .start()

  const host = container.getHost()
  const port = container.getMappedPort(5432)
  const connectionString = `postgres://postgres:postgres@${host}:${port}/crm_test`

  const { Pool } = pg
  const pool = new Pool({ connectionString, max: 10 })

  db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  })

  // Run migrations
  const { migrateUp } = await import('../../src/shared/database/migrate.js')
  await migrateUp(db)

  return db
}

export async function stopTestDatabase(): Promise<void> {
  if (db) {
    await db.destroy()
    db = null
  }
  if (container) {
    await container.stop()
    container = null
  }
}

export function getTestDb(): Kysely<Database> {
  if (!db)
    throw new Error(
      'Test database not started. Call startTestDatabase() first.',
    )
  return db
}

export async function truncateAllTables(): Promise<void> {
  const database = getTestDb()
  const tables = [
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
  ]
  for (const table of tables) {
    await database.executeQuery(
      database.queryCompiler.truncateTable(table).compile(database),
    )
  }
}
