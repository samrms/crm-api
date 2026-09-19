import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('memberships')
    .addColumn('id', 'varchar(21)', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(21)', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('organization_id', 'varchar(21)', (col) =>
      col.notNull().references('organizations.id').onDelete('cascade'),
    )
    .addColumn('role', 'varchar(20)', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(db.fn('now')),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(db.fn('now')),
    )
    .addUniqueConstraint('unique_user_org', ['user_id', 'organization_id'])
    .execute()

  // Add CHECK constraint via raw SQL
  await sql`ALTER TABLE memberships ADD CONSTRAINT membership_role_check CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER'))`.execute(
    db,
  )

  await db.schema
    .createIndex('idx_memberships_user_id')
    .on('memberships')
    .column('user_id')
    .execute()

  await db.schema
    .createIndex('idx_memberships_organization_id')
    .on('memberships')
    .column('organization_id')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('memberships').execute()
}
