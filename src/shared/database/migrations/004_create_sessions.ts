import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('sessions')
    .ifNotExists()
    .addColumn('id', 'varchar(21)', (col) => col.primaryKey())
    .addColumn('token', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('user_id', 'varchar(21)', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('organization_id', 'varchar(21)', (col) =>
      col.notNull().references('organizations.id').onDelete('cascade'),
    )
    .addColumn('expires_at', 'text', (col) => col.notNull())
    .addColumn('revoked_at', 'text')
    .addColumn('created_at', 'text', (col) =>
      col.notNull().defaultTo('CURRENT_TIMESTAMP'),
    )
    .execute()

  await db.schema
    .createIndex('idx_sessions_token')
    .ifNotExists()
    .on('sessions')
    .column('token')
    .execute()

  await db.schema
    .createIndex('idx_sessions_user_id')
    .ifNotExists()
    .on('sessions')
    .column('user_id')
    .execute()

  await db.schema
    .createIndex('idx_sessions_expires_at')
    .ifNotExists()
    .on('sessions')
    .column('expires_at')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('sessions').execute()
}
