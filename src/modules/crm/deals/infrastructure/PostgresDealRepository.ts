import type { Kysely } from 'kysely'
import type { DealsTable, Database } from '@/shared/database/types.js'

export type DealRow = DealsTable

export interface DealRepository {
  findById(id: string, organizationId: string): Promise<DealRow | undefined>
  list(
    organizationId: string,
    opts: { limit: number; after?: string; stage?: string },
  ): Promise<DealRow[]>
  create(data: {
    id: string
    organizationId: string
    title: string
    companyId?: string
    contactId?: string
    leadId?: string
    value?: number
    currency?: string
    notes?: string
  }): Promise<DealRow>
  update(
    id: string,
    organizationId: string,
    data: {
      title?: string
      companyId?: string
      contactId?: string
      value?: number
      currency?: string
      notes?: string
    },
    version: number,
  ): Promise<DealRow | undefined>
  updateStage(
    id: string,
    organizationId: string,
    stage: DealRow['stage'],
    version: number,
  ): Promise<DealRow | undefined>
  softDelete(id: string, organizationId: string): Promise<boolean>
}

export class PostgresDealRepository implements DealRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(
    id: string,
    organizationId: string,
  ): Promise<DealRow | undefined> {
    const row = await this.db
      .selectFrom('deals')
      .selectAll()
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return row as DealRow | undefined
  }

  async list(
    organizationId: string,
    opts: { limit: number; after?: string; stage?: string },
  ): Promise<DealRow[]> {
    let query = this.db
      .selectFrom('deals')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)

    if (opts.stage) {
      query = query.where('stage', '=', opts.stage as DealRow['stage'])
    }

    query = query
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
          eb.and([
            eb('created_at', '=', new Date(decoded.createdAt)),
            eb('id', '<', decoded.id),
          ]),
        ]),
      )
    }

    const rows = await query.execute()
    return rows.slice(0, opts.limit) as DealRow[]
  }

  async create(data: {
    id: string
    organizationId: string
    title: string
    companyId?: string
    contactId?: string
    leadId?: string
    value?: number
    currency?: string
    notes?: string
  }): Promise<DealRow> {
    const now = new Date()
    const row = await this.db
      .insertInto('deals')
      .values({
        id: data.id,
        organization_id: data.organizationId,
        title: data.title,
        companyId: data.companyId ?? null,
        contactId: data.contactId ?? null,
        leadId: data.leadId ?? null,
        value: data.value ?? null,
        currency: data.currency ?? 'USD',
        stage: 'NEW',
        notes: data.notes ?? null,
        version: 1,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    return row as DealRow
  }

  async update(
    id: string,
    organizationId: string,
    data: {
      title?: string
      companyId?: string
      contactId?: string
      value?: number
      currency?: string
      notes?: string
    },
    version: number,
  ): Promise<DealRow | undefined> {
    const row = await this.db
      .updateTable('deals')
      .set({ ...data, version: version + 1, updated_at: new Date() })
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('version', '=', version)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst()
    return row as DealRow | undefined
  }

  async updateStage(
    id: string,
    organizationId: string,
    stage: DealRow['stage'],
    version: number,
  ): Promise<DealRow | undefined> {
    const row = await this.db
      .updateTable('deals')
      .set({ stage, version: version + 1, updated_at: new Date() })
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('version', '=', version)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst()
    return row as DealRow | undefined
  }

  async softDelete(id: string, organizationId: string): Promise<boolean> {
    const row = await this.db
      .updateTable('deals')
      .set({ deleted_at: new Date(), updated_at: new Date() })
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst()
    return !!row
  }
}
