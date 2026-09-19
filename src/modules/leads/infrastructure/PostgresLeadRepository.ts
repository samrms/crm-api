import { getDb } from '../../../shared/database/connection.js'
import type { LeadsTable } from '../../../shared/database/types.js'

export type LeadRow = LeadsTable

export interface LeadRepository {
  findById(id: string, organizationId: string): Promise<LeadRow | undefined>
  list(
    organizationId: string,
    opts: { limit: number; after?: string },
  ): Promise<LeadRow[]>
  create(data: {
    id: string
    organizationId: string
    email: string
    firstName: string
    lastName: string
    company?: string
    source?: string
    notes?: string
  }): Promise<LeadRow>
  updateStatus(
    id: string,
    organizationId: string,
    status: LeadRow['status'],
    version: number,
  ): Promise<LeadRow | undefined>
  updateWithDeal(
    id: string,
    organizationId: string,
    dealId: string,
  ): Promise<void>
}

export class PostgresLeadRepository implements LeadRepository {
  async findById(
    id: string,
    organizationId: string,
  ): Promise<LeadRow | undefined> {
    const row = await getDb()
      .selectFrom('leads')
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return row as LeadRow | undefined
  }

  async list(
    organizationId: string,
    opts: { limit: number; after?: string },
  ): Promise<LeadRow[]> {
    let query = getDb()
      .selectFrom('leads')
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(opts.limit + 1)

    if (opts.after) {
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
    return rows as LeadRow[]
  }

  async create(data: {
    id: string
    organizationId: string
    email: string
    firstName: string
    lastName: string
    company?: string
    source?: string
    notes?: string
  }): Promise<LeadRow> {
    const now = new Date()
    const row = await getDb()
      .insertInto('leads')
      .values({
        id: data.id,
        organization_id: data.organizationId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        company: data.company ?? null,
        source: data.source ?? null,
        notes: data.notes ?? null,
        status: 'NEW',
        version: 1,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    return row as LeadRow
  }

  async updateStatus(
    id: string,
    organizationId: string,
    status: LeadRow['status'],
    version: number,
  ): Promise<LeadRow | undefined> {
    const row = await getDb()
      .updateTable('leads')
      .set({ status, version: version + 1, updated_at: new Date() })
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('version', '=', version)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst()
    return row as LeadRow | undefined
  }

  async updateWithDeal(
    id: string,
    organizationId: string,
    dealId: string,
  ): Promise<void> {
    await getDb()
      .updateTable('leads')
      .set({ convertedDealId: dealId, updated_at: new Date() })
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .execute()
  }
}
