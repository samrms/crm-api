import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('contacts')
    .ifNotExists()
    .addColumn('id', 'varchar(21)', (col) => col.primaryKey())
    .addColumn('organization_id', 'varchar(21)', (col) =>
      col.notNull().references('organizations.id').onDelete('cascade'),
    )
    .addColumn('company_id', 'varchar(21)', (col) =>
      col.references('companies.id').onDelete('set null'),
    )
    .addColumn('email', 'varchar(255)', (col) => col.notNull())
    .addColumn('firstName', 'varchar(255)', (col) => col.notNull())
    .addColumn('lastName', 'varchar(255)', (col) => col.notNull())
    .addColumn('phone', 'varchar(50)')
    .addColumn('title', 'varchar(255)')
    .addColumn('notes', 'text')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(db.fn('now')),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(db.fn('now')),
    )
    .addColumn('deleted_at', 'timestamptz')
    .execute()

  await db.schema
    .createIndex('idx_contacts_organization_id')
    .ifNotExists()
    .on('contacts')
    .column('organization_id')
    .execute()

  await db.schema
    .createIndex('idx_contacts_company_id')
    .ifNotExists()
    .on('contacts')
    .column('company_id')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('contacts').execute()
}
