import type { Kysely } from 'kysely'
import { decodeCursor } from '@/shared/pagination/CursorEncoder.js'
import { AppError } from '@/shared/errors/AppError.js'
import type { CompaniesTable, Database } from '@/shared/database/types.js'

export type CompanyRow = CompaniesTable

export interface CompanyRepository {
  findById(id: string, organizationId: string): Promise<CompanyRow | undefined>
  findByName(
    name: string,
    organizationId: string,
  ): Promise<CompanyRow | undefined>
  list(
    organizationId: string,
    opts: { limit: number; after?: string; name?: string },
  ): Promise<CompanyRow[]>
  create(data: {
    id: string
    organizationId: string
    name: string
    domain?: string
    industry?: string
    size?: string
    website?: string
  }): Promise<CompanyRow>
  update(
    id: string,
    organizationId: string,
    data: {
      name?: string
      domain?: string
      industry?: string
      size?: string
      website?: string
    },
  ): Promise<CompanyRow | undefined>
  softDelete(id: string, organizationId: string): Promise<boolean>
}

export class PostgresCompanyRepository implements CompanyRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(
    id: string,
    organizationId: string,
  ): Promise<CompanyRow | undefined> {
    const row = await this.db
      .selectFrom('companies')
      .selectAll()
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return row as CompanyRow | undefined
  }

  async findByName(
    name: string,
    organizationId: string,
  ): Promise<CompanyRow | undefined> {
    const row = await this.db
      .selectFrom('companies')
      .selectAll()
      .where('name', '=', name)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return row as CompanyRow | undefined
  }

  async list(
    organizationId: string,
    opts: { limit: number; after?: string; name?: string },
  ): Promise<CompanyRow[]> {
    let query = this.db
      .selectFrom('companies')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(opts.limit + 1)

    if (opts.name) {
      query = query.where('name', '=', opts.name)
    }

    if (opts.after) {
      // The cursor is HMAC-signed, so it must be decoded with the same
      // helper that produced it. Raw base64 decoding would include the
      // signature suffix and fail to parse.
      const decoded = decodeCursor(opts.after)
      if (!decoded)
        throw new AppError({
          statusCode: 400,
          code: 'INVALID_CURSOR',
          message: 'Invalid or tampered pagination cursor',
        })
      query = query.where((eb) =>
        eb.or([
          eb('created_at', '<', new Date(decoded.createdAt)),
          eb.and([
            eb('created_at', '=', new Date(decoded.createdAt)),
            eb('id', '<', decoded.id),
          ]),
        ]),
      )
    }

    const rows = await query.execute()
    return rows as CompanyRow[]
  }

  async create(data: {
    id: string
    organizationId: string
    name: string
    domain?: string
    industry?: string
    size?: string
    website?: string
  }): Promise<CompanyRow> {
    const now = new Date()
    const row = await this.db
      .insertInto('companies')
      .values({
        id: data.id,
        organization_id: data.organizationId,
        name: data.name,
        domain: data.domain ?? null,
        industry: data.industry ?? null,
        size: data.size ?? null,
        website: data.website ?? null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    return row as CompanyRow
  }

  async update(
    id: string,
    organizationId: string,
    data: {
      name?: string
      domain?: string
      industry?: string
      size?: string
      website?: string
    },
  ): Promise<CompanyRow | undefined> {
    const row = await this.db
      .updateTable('companies')
      .set({ ...data, updated_at: new Date() })
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst()
    return row as CompanyRow | undefined
  }

  async softDelete(id: string, organizationId: string): Promise<boolean> {
    const row = await this.db
      .updateTable('companies')
      .set({ deleted_at: new Date(), updated_at: new Date() })
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst()
    return !!row
  }
}
