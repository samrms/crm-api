import type { Kysely } from 'kysely'
import { decodeCursor } from '@/shared/pagination/CursorEncoder.js'
import { AppError } from '@/shared/errors/AppError.js'
import type { LeadsTable, Database } from '@/shared/database/types.js'

export type LeadRow = LeadsTable

export interface LeadRepository {
  findById(id: string, organizationId: string): Promise<LeadRow | undefined>
  list(
    organizationId: string,
    opts: { limit: number; after?: string; status?: string },
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
  update(
    id: string,
    organizationId: string,
    data: {
      email?: string
      firstName?: string
      lastName?: string
      company?: string
      source?: string
      notes?: string
    },
    version: number,
  ): Promise<LeadRow | undefined>
  updateStatus(
    id: string,
    organizationId: string,
    status: LeadRow['status'],
    version: number,
  ): Promise<LeadRow | undefined>
  softDelete(id: string, organizationId: string): Promise<boolean>
}

export class PostgresLeadRepository implements LeadRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(
    id: string,
    organizationId: string,
  ): Promise<LeadRow | undefined> {
    const row = await this.db
      .selectFrom('leads')
      .selectAll()
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return row as LeadRow | undefined
  }

  async list(
    organizationId: string,
    opts: { limit: number; after?: string; status?: string },
  ): Promise<LeadRow[]> {
    let query = this.db
      .selectFrom('leads')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)

    if (opts.status) {
      query = query.where('status', '=', opts.status as LeadRow['status'])
    }

    query = query
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(opts.limit + 1)

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
    const row = await this.db
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

  async update(
    id: string,
    organizationId: string,
    data: {
      email?: string
      firstName?: string
      lastName?: string
      company?: string
      source?: string
      notes?: string
    },
    version: number,
  ): Promise<LeadRow | undefined> {
    const row = await this.db
      .updateTable('leads')
      .set({ ...data, version: version + 1, updated_at: new Date() })
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('version', '=', version)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst()
    return row as LeadRow | undefined
  }

  async updateStatus(
    id: string,
    organizationId: string,
    status: LeadRow['status'],
    version: number,
  ): Promise<LeadRow | undefined> {
    const row = await this.db
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

  async softDelete(id: string, organizationId: string): Promise<boolean> {
    const row = await this.db
      .updateTable('leads')
      .set({ deleted_at: new Date(), updated_at: new Date() })
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst()
    return !!row
  }
}
