import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('outbox_events')
    .ifNotExists()
    .addColumn('id', 'varchar(21)', (col) => col.primaryKey())
    .addColumn('organization_id', 'varchar(21)', (col) =>
      col.notNull().references('organizations.id').onDelete('cascade'),
    )
    .addColumn('type', 'varchar(100)', (col) => col.notNull())
    .addColumn('payload', 'text', (col) => col.notNull())
    .addColumn('processed_at', 'text')
    .addColumn('created_at', 'text', (col) =>
      col.notNull().defaultTo('CURRENT_TIMESTAMP'),
    )
    .execute()

  await db.schema
    .createIndex('idx_outbox_events_processed_at')
    .ifNotExists()
    .on('outbox_events')
    .column('processed_at')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('outbox_events').execute()
}
