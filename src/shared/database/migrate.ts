import {
  type Kysely,
  type Migration,
  type MigrationProvider,
  Migrator,
} from 'kysely'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDb } from './connection.js'
import type { Database } from './types.js'
import { logger } from '@/shared/logging/logger.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const MIGRATIONS_DIR = join(__dirname, 'migrations')

class FileMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
      .sort()

    const migrations: Record<string, Migration> = {}
    for (const file of files) {
      const name = file.replace(/\.(ts|js)$/, '')
      const module = await import(join(MIGRATIONS_DIR, file))
      migrations[name] = module.default ?? module
    }
    return migrations
  }
}

function createMigrator(db: Kysely<Database>): Migrator {
  return new Migrator({
    db,
    provider: new FileMigrationProvider(),
    migrationTableName: 'kysely_migrations',
  })
}

export async function migrateUp(db?: Kysely<Database>): Promise<void> {
  const database = db ?? getDb()
  const migrator = createMigrator(database)
  const { results, error } = await migrator.migrateUp()

  if (error) {
    logger.error({ error }, 'Migration failed')
    throw error
  }

  for (const result of results ?? []) {
    logger.info(
      { migration: result.migrationName, status: result.status },
      'Migration applied',
    )
  }
}

export async function migrateDown(db?: Kysely<Database>): Promise<void> {
  const database = db ?? getDb()
  const migrator = createMigrator(database)
  const { results, error } = await migrator.migrateDown()

  if (error) {
    logger.error({ error }, 'Migration rollback failed')
    throw error
  }

  for (const result of results ?? []) {
    logger.info(
      { migration: result.migrationName, status: result.status },
      'Migration rolled back',
    )
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  const command = process.argv[2]
  if (command === 'rollback') {
    migrateDown()
      .then(() => process.exit(0))
      .catch(() => process.exit(1))
  } else {
    migrateUp()
      .then(() => process.exit(0))
      .catch(() => process.exit(1))
  }
}
