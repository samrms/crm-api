import type { Kysely } from 'kysely'
import type {
  PasswordResetTokensTable,
  Database,
} from '@/shared/database/types.js'

export type PasswordResetTokenRow = PasswordResetTokensTable

export interface PasswordResetRepository {
  create(data: {
    id: string
    userId: string
    tokenHash: string
    expiresAt: Date
  }): Promise<PasswordResetTokenRow>
  findValidByTokenHash(tokenHash: string): Promise<PasswordResetTokenRow | undefined>
  markUsed(id: string): Promise<void>
}

export class PostgresPasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(data: {
    id: string
    userId: string
    tokenHash: string
    expiresAt: Date
  }): Promise<PasswordResetTokenRow> {
    const row = await this.db
      .insertInto('password_reset_tokens')
      .values({
        id: data.id,
        user_id: data.userId,
        token_hash: data.tokenHash,
        expires_at: data.expiresAt,
        created_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    return row as PasswordResetTokenRow
  }

  async findValidByTokenHash(
    tokenHash: string,
  ): Promise<PasswordResetTokenRow | undefined> {
    const row = await this.db
      .selectFrom('password_reset_tokens')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .where('used_at', 'is', null)
      .where('expires_at', '>', new Date())
      .executeTakeFirst()
    return row as PasswordResetTokenRow | undefined
  }

  async markUsed(id: string): Promise<void> {
    await this.db
      .updateTable('password_reset_tokens')
      .set({ used_at: new Date() })
      .where('id', '=', id)
      .execute()
  }
}
