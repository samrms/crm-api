import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('audit_events')
    .addColumn('id', 'varchar(21)', (col) => col.primaryKey())
    .addColumn('organization_id', 'varchar(21)', (col) =>
      col.notNull().references('organizations.id').onDelete('cascade'),
    )
    .addColumn('actor_id', 'varchar(21)', (col) => col.notNull())
    .addColumn('action', 'varchar(100)', (col) => col.notNull())
    .addColumn('resource_type', 'varchar(50)', (col) => col.notNull())
    .addColumn('resource_id', 'varchar(21)')
    .addColumn('request_id', 'varchar(50)')
    .addColumn('metadata', 'jsonb')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(db.fn('now')),
    )
    .execute()

  await db.schema
    .createIndex('idx_audit_events_organization_id')
    .on('audit_events')
    .column('organization_id')
    .execute()

  await db.schema
    .createIndex('idx_audit_events_actor_id')
    .on('audit_events')
    .column('actor_id')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('audit_events').execute()
}
