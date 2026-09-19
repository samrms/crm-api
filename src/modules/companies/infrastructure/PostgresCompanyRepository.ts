import { getDb } from '../../../shared/database/connection.js'
import type { CompaniesTable } from '../../../shared/database/types.js'

export type CompanyRow = CompaniesTable

export interface CompanyRepository {
  findById(id: string, organizationId: string): Promise<CompanyRow | undefined>
  findByName(
    name: string,
    organizationId: string,
  ): Promise<CompanyRow | undefined>
  list(
    organizationId: string,
    opts: { limit: number; after?: string },
  ): Promise<CompanyRow[]>
  create(data: {
    id: string
    organizationId: string
    name: string
    domain?: string
    industry?: string
    website?: string
  }): Promise<CompanyRow>
  update(
    id: string,
    organizationId: string,
    data: {
      name?: string
      domain?: string
      industry?: string
      website?: string
    },
  ): Promise<CompanyRow | undefined>
}

export class PostgresCompanyRepository implements CompanyRepository {
  async findById(
    id: string,
    organizationId: string,
  ): Promise<CompanyRow | undefined> {
    const row = await getDb()
      .selectFrom('companies')
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
    const row = await getDb()
      .selectFrom('companies')
      .where('name', '=', name)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return row as CompanyRow | undefined
  }

  async list(
    organizationId: string,
    opts: { limit: number; after?: string },
  ): Promise<CompanyRow[]> {
    let query = getDb()
      .selectFrom('companies')
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(opts.limit + 1)

    if (opts.after) {
      // Simple cursor: decode and filter
      const decoded = JSON.parse(
        Buffer.from(opts.after, 'base64url').toString(),
      )
      query = query.where((eb) =>
        eb.or([
          eb('created_at', '<', new Date(decoded.createdAt)),
          eb('created_at', '=', new Date(decoded.createdAt)),
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
    website?: string
  }): Promise<CompanyRow> {
    const now = new Date()
    const row = await getDb()
      .insertInto('companies')
      .values({
        id: data.id,
        organization_id: data.organizationId,
        name: data.name,
        domain: data.domain ?? null,
        industry: data.industry ?? null,
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
      website?: string
    },
  ): Promise<CompanyRow | undefined> {
    const row = await getDb()
      .updateTable('companies')
      .set({ ...data, updated_at: new Date() })
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst()
    return row as CompanyRow | undefined
  }
}
