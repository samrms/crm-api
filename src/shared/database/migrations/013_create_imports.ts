import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('imports')
    .addColumn('id', 'varchar(21)', (col) => col.primaryKey())
    .addColumn('organization_id', 'varchar(21)', (col) =>
      col.notNull().references('organizations.id').onDelete('cascade'),
    )
    .addColumn('actor_id', 'varchar(21)', (col) => col.notNull())
    .addColumn('type', 'varchar(50)', (col) => col.notNull())
    .addColumn('status', 'varchar(20)', (col) =>
      col.notNull().defaultTo('PENDING'),
    )
    .addColumn('total', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('processed', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('successful', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('failed', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('file_path', 'varchar(500)')
    .addColumn('error_message', 'text')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(db.fn('now')),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(db.fn('now')),
    )
    .execute()

  await db.schema
    .createIndex('idx_imports_organization_id')
    .on('imports')
    .column('organization_id')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('imports').execute()
}
