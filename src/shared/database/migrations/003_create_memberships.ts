import { sql } from 'kysely'
import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('memberships')
    .ifNotExists()
    .addColumn('id', 'varchar(21)', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(21)', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('organization_id', 'varchar(21)', (col) =>
      col.notNull().references('organizations.id').onDelete('cascade'),
    )
    .addColumn('role', 'varchar(20)', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) =>
      col.notNull().defaultTo('CURRENT_TIMESTAMP'),
    )
    .addColumn('updated_at', 'text', (col) =>
      col.notNull().defaultTo('CURRENT_TIMESTAMP'),
    )
    .addUniqueConstraint('unique_user_org', ['user_id', 'organization_id'])
    .addCheckConstraint(
      'membership_role_check',
      sql`role in ('OWNER', 'ADMIN', 'MEMBER')`,
    )
    .execute()

  await db.schema
    .createIndex('idx_memberships_user_id')
    .ifNotExists()
    .on('memberships')
    .column('user_id')
    .execute()
  await db.schema
    .createIndex('idx_memberships_organization_id')
    .ifNotExists()
    .on('memberships')
    .column('organization_id')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('memberships').execute()
}
