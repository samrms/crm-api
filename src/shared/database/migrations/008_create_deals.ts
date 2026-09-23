import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('deals')
    .ifNotExists()
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
    .addColumn('expectedCloseDate', 'text')
    .addColumn('notes', 'text')
    .addColumn('version', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (col) =>
      col.notNull().defaultTo('CURRENT_TIMESTAMP'),
    )
    .addColumn('updated_at', 'text', (col) =>
      col.notNull().defaultTo('CURRENT_TIMESTAMP'),
    )
    .addColumn('deleted_at', 'text')
    .execute()

  await db.schema
    .createIndex('idx_deals_organization_id')
    .ifNotExists()
    .on('deals')
    .column('organization_id')
    .execute()

  await db.schema
    .createIndex('idx_deals_stage')
    .ifNotExists()
    .on('deals')
    .column('stage')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('deals').execute()
}
