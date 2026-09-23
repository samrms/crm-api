import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('exports')
    .ifNotExists()
    .addColumn('id', 'varchar(21)', (col) => col.primaryKey())
    .addColumn('organization_id', 'varchar(21)', (col) =>
      col.notNull().references('organizations.id').onDelete('cascade'),
    )
    .addColumn('actor_id', 'varchar(21)', (col) => col.notNull())
    .addColumn('type', 'varchar(50)', (col) => col.notNull())
    .addColumn('status', 'varchar(20)', (col) =>
      col.notNull().defaultTo('PENDING'),
    )
    .addColumn('file_path', 'varchar(500)')
    .addColumn('download_url', 'varchar(1000)')
    .addColumn('error_message', 'text')
    .addColumn('created_at', 'text', (col) =>
      col.notNull().defaultTo('CURRENT_TIMESTAMP'),
    )
    .addColumn('updated_at', 'text', (col) =>
      col.notNull().defaultTo('CURRENT_TIMESTAMP'),
    )
    .execute()

  await db.schema
    .createIndex('idx_exports_organization_id')
    .ifNotExists()
    .on('exports')
    .column('organization_id')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('exports').execute()
}
