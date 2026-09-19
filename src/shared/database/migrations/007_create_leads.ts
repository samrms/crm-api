import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('leads')
    .addColumn('id', 'varchar(21)', (col) => col.primaryKey())
    .addColumn('organization_id', 'varchar(21)', (col) =>
      col.notNull().references('organizations.id').onDelete('cascade'),
    )
    .addColumn('companyId', 'varchar(21)')
    .addColumn('contactId', 'varchar(21)')
    .addColumn('email', 'varchar(255)', (col) => col.notNull())
    .addColumn('firstName', 'varchar(255)', (col) => col.notNull())
    .addColumn('lastName', 'varchar(255)', (col) => col.notNull())
    .addColumn('company', 'varchar(255)')
    .addColumn('source', 'varchar(255)')
    .addColumn('status', 'varchar(20)', (col) => col.notNull().defaultTo('NEW'))
    .addColumn('convertedDealId', 'varchar(21)')
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
    .createIndex('idx_leads_organization_id')
    .on('leads')
    .column('organization_id')
    .execute()

  await db.schema
    .createIndex('idx_leads_status')
    .on('leads')
    .column('status')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('leads').execute()
}
