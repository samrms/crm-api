import {
  type Kysely,
  type Migration,
  type MigrationProvider,
  Migrator as KyselyMigrator,
} from 'kysely'
import { database } from './connection.js'
import type { Database } from './types.js'
import { logger } from '@/shared/logging/logger.js'

import * as m001 from './migrations/001_create_organizations.js'
import * as m002 from './migrations/002_create_users.js'
import * as m003 from './migrations/003_create_memberships.js'
import * as m004 from './migrations/004_create_sessions.js'
import * as m005 from './migrations/005_create_companies.js'
import * as m006 from './migrations/006_create_contacts.js'
import * as m007 from './migrations/007_create_leads.js'
import * as m008 from './migrations/008_create_deals.js'
import * as m009 from './migrations/009_create_activities.js'
import * as m010 from './migrations/010_create_tasks.js'
import * as m011 from './migrations/011_create_audit_events.js'
import * as m012 from './migrations/012_create_outbox_events.js'
import * as m013 from './migrations/013_create_imports.js'
import * as m014 from './migrations/014_create_exports.js'
import * as m015 from './migrations/015_create_password_reset_tokens.js'

class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return {
      '001_create_organizations': m001,
      '002_create_users': m002,
      '003_create_memberships': m003,
      '004_create_sessions': m004,
      '005_create_companies': m005,
      '006_create_contacts': m006,
      '007_create_leads': m007,
      '008_create_deals': m008,
      '009_create_activities': m009,
      '010_create_tasks': m010,
      '011_create_audit_events': m011,
      '012_create_outbox_events': m012,
      '013_create_imports': m013,
      '014_create_exports': m014,
      '015_create_password_reset_tokens': m015,
    }
  }
}

export class DatabaseMigrator {
  private readonly db: Kysely<Database>

  constructor(db: Kysely<Database> = database.db) {
    this.db = db
  }

  async up(): Promise<void> {
    const migrator = new KyselyMigrator({
      db: this.db,
      provider: new StaticMigrationProvider(),
      migrationTableName: 'kysely_migrations',
    })
    const { results, error } = await migrator.migrateToLatest()
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

  async down(): Promise<void> {
    const migrator = new KyselyMigrator({
      db: this.db,
      provider: new StaticMigrationProvider(),
      migrationTableName: 'kysely_migrations',
    })
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
}

if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  const migrator = new DatabaseMigrator()
  const command = process.argv[2]
  if (command === 'rollback') {
    migrator
      .down()
      .then(() => process.exit(0))
      .catch(() => process.exit(1))
  } else {
    migrator
      .up()
      .then(() => process.exit(0))
      .catch(() => process.exit(1))
  }
}
