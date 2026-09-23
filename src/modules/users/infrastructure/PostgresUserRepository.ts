import type { Kysely } from 'kysely'
import type { UsersTable, Database } from '@/shared/database/types.js'

export type UserRow = UsersTable

export interface UserRepository {
  findById(id: string): Promise<UserRow | undefined>
  findByEmail(email: string): Promise<UserRow | undefined>
  create(data: {
    id: string
    email: string
    name: string
    passwordHash: string
  }): Promise<UserRow>
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(id: string): Promise<UserRow | undefined> {
    const row = await this.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return row as UserRow | undefined
  }

  async findByEmail(email: string): Promise<UserRow | undefined> {
    const row = await this.db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return row as UserRow | undefined
  }

  async create(data: {
    id: string
    email: string
    name: string
    passwordHash: string
  }): Promise<UserRow> {
    const now = new Date()
    const row = await this.db
      .insertInto('users')
      .values({
        id: data.id,
        email: data.email,
        name: data.name,
        password_hash: data.passwordHash,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    return row as UserRow
  }
}
