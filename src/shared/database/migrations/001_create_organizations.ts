import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('organizations')
    .ifNotExists()
    .addColumn('id', 'varchar(21)', (col) => col.primaryKey())
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('slug', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(db.fn('now')),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(db.fn('now')),
    )
    .addColumn('deleted_at', 'timestamptz')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('organizations').execute()
}
