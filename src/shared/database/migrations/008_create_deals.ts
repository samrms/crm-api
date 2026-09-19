import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('deals')
    .addColumn('id', 'varchar(21)', (col) => col.primaryKey())
    .addColumn('organization_id', 'varchar(21)', (col) =>
      col.notNull().references('organizations.id').onDelete('cascade'),
    )
    .addColumn('companyId', 'varchar(21)')
    .addColumn('contactId', 'varchar(21)')
    .addColumn('leadId', 'varchar(21)')
    .addColumn('title', 'varchar(255)', (col) => col.notNull())
    .addColumn('value', 'numeric')
    .addColumn('currency', 'varchar(3)', (col) =>
      col.notNull().defaultTo('USD'),
    )
    .addColumn('stage', 'varchar(20)', (col) => col.notNull().defaultTo('NEW'))
    .addColumn('expectedCloseDate', 'timestamptz')
    .addColumn('notes', 'text')
    .addColumn('version', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(db.fn('now')),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(db.fn('now')),
    )
    .addColumn('deleted_at', 'timestamptz')
    .execute()

  await db.schema
    .createIndex('idx_deals_organization_id')
    .on('deals')
    .column('organization_id')
    .execute()

  await db.schema
    .createIndex('idx_deals_stage')
    .on('deals')
    .column('stage')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('deals').execute()
}
