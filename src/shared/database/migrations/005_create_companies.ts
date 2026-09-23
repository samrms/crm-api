import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('companies')
    .ifNotExists()
    .addColumn('id', 'varchar(21)', (col) => col.primaryKey())
    .addColumn('organization_id', 'varchar(21)', (col) =>
      col.notNull().references('organizations.id').onDelete('cascade'),
    )
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('domain', 'varchar(255)')
    .addColumn('industry', 'varchar(255)')
    .addColumn('size', 'varchar(50)')
    .addColumn('website', 'varchar(255)')
    .addColumn('notes', 'text')
    .addColumn('created_at', 'text', (col) =>
      col.notNull().defaultTo('CURRENT_TIMESTAMP'),
    )
    .addColumn('updated_at', 'text', (col) =>
      col.notNull().defaultTo('CURRENT_TIMESTAMP'),
    )
    .addColumn('deleted_at', 'text')
    .execute()

  await db.schema
    .createIndex('idx_companies_organization_id')
    .ifNotExists()
    .on('companies')
    .column('organization_id')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('companies').execute()
}
