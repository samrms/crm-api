import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('password_reset_tokens')
    .ifNotExists()
    .addColumn('id', 'varchar(21)', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(21)', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('token_hash', 'varchar(64)', (col) => col.notNull().unique())
    .addColumn('expires_at', 'text', (col) => col.notNull())
    .addColumn('used_at', 'text')
    .addColumn('created_at', 'text', (col) =>
      col.notNull().defaultTo('CURRENT_TIMESTAMP'),
    )
    .execute()

  await db.schema
    .createIndex('idx_password_reset_tokens_user_id')
    .ifNotExists()
    .on('password_reset_tokens')
    .column('user_id')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('password_reset_tokens').execute()
}
