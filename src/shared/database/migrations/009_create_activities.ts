import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('activities')
    .ifNotExists()
    .addColumn('id', 'varchar(21)', (col) => col.primaryKey())
    .addColumn('organization_id', 'varchar(21)', (col) =>
      col.notNull().references('organizations.id').onDelete('cascade'),
    )
    .addColumn('dealId', 'varchar(21)')
    .addColumn('leadId', 'varchar(21)')
    .addColumn('contactId', 'varchar(21)')
    .addColumn('companyId', 'varchar(21)')
    .addColumn('type', 'varchar(20)', (col) => col.notNull())
    .addColumn('subject', 'varchar(255)', (col) => col.notNull())
    .addColumn('body', 'text')
    .addColumn('occurredAt', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(db.fn('now')),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(db.fn('now')),
    )
    .execute()

  await db.schema
    .createIndex('idx_activities_organization_id')
    .ifNotExists()
    .on('activities')
    .column('organization_id')
    .execute()

  await db.schema
    .createIndex('idx_activities_deal_id')
    .ifNotExists()
    .on('activities')
    .column('dealId')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('activities').execute()
}
