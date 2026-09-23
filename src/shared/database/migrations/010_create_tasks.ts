import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('tasks')
    .ifNotExists()
    .addColumn('id', 'varchar(21)', (col) => col.primaryKey())
    .addColumn('organization_id', 'varchar(21)', (col) =>
      col.notNull().references('organizations.id').onDelete('cascade'),
    )
    .addColumn('dealId', 'varchar(21)')
    .addColumn('leadId', 'varchar(21)')
    .addColumn('contactId', 'varchar(21)')
    .addColumn('title', 'varchar(255)', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('status', 'varchar(20)', (col) =>
      col.notNull().defaultTo('PENDING'),
    )
    .addColumn('dueDate', 'text')
    .addColumn('assignedToId', 'varchar(21)')
    .addColumn('created_at', 'text', (col) =>
      col.notNull().defaultTo('CURRENT_TIMESTAMP'),
    )
    .addColumn('updated_at', 'text', (col) =>
      col.notNull().defaultTo('CURRENT_TIMESTAMP'),
    )
    .addColumn('deleted_at', 'text')
    .execute()

  await db.schema
    .createIndex('idx_tasks_organization_id')
    .ifNotExists()
    .on('tasks')
    .column('organization_id')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('tasks').execute()
}
