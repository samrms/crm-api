import type { Kysely } from 'kysely'
import { decodeCursor } from '@/shared/pagination/CursorEncoder.js'
import { AppError } from '@/shared/errors/AppError.js'
import type { ContactsTable, Database } from '@/shared/database/types.js'

export type ContactRow = ContactsTable

export interface ContactRepository {
  findById(id: string, organizationId: string): Promise<ContactRow | undefined>
  findByEmail(
    email: string,
    organizationId: string,
  ): Promise<ContactRow | undefined>
  findByEmailAndCompany(
    email: string,
    companyId: string,
    organizationId: string,
  ): Promise<ContactRow | undefined>
  list(
    organizationId: string,
    opts: { limit: number; after?: string },
  ): Promise<ContactRow[]>
  create(data: {
    id: string
    organizationId: string
    companyId?: string
    email: string
    firstName: string
    lastName: string
    phone?: string
    title?: string
    notes?: string
  }): Promise<ContactRow>
  update(
    id: string,
    organizationId: string,
    data: {
      companyId?: string
      email?: string
      firstName?: string
      lastName?: string
      phone?: string
      title?: string
      notes?: string
    },
  ): Promise<ContactRow | undefined>
  softDelete(id: string, organizationId: string): Promise<boolean>
}

export class PostgresContactRepository implements ContactRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(
    id: string,
    organizationId: string,
  ): Promise<ContactRow | undefined> {
    const row = await this.db
      .selectFrom('contacts')
      .selectAll()
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return row as ContactRow | undefined
  }

  async findByEmail(
    email: string,
    organizationId: string,
  ): Promise<ContactRow | undefined> {
    const row = await this.db
      .selectFrom('contacts')
      .selectAll()
      .where('email', '=', email)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return row as ContactRow | undefined
  }

  async findByEmailAndCompany(
    email: string,
    companyId: string,
    organizationId: string,
  ): Promise<ContactRow | undefined> {
    const row = await this.db
      .selectFrom('contacts')
      .selectAll()
      .where('email', '=', email)
      .where('company_id', '=', companyId)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return row as ContactRow | undefined
  }

  async list(
    organizationId: string,
    opts: { limit: number; after?: string },
  ): Promise<ContactRow[]> {
    let query = this.db
      .selectFrom('contacts')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
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
    return rows as ContactRow[]
  }

  async create(data: {
    id: string
    organizationId: string
    companyId?: string
    email: string
    firstName: string
    lastName: string
    phone?: string
    title?: string
    notes?: string
  }): Promise<ContactRow> {
    const now = new Date()
    const row = await this.db
      .insertInto('contacts')
      .values({
        id: data.id,
        organization_id: data.organizationId,
        company_id: data.companyId ?? null,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone ?? null,
        title: data.title ?? null,
        notes: data.notes ?? null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    return row as ContactRow
  }

  async update(
    id: string,
    organizationId: string,
    data: {
      companyId?: string
      email?: string
      firstName?: string
      lastName?: string
      phone?: string
      title?: string
      notes?: string
    },
  ): Promise<ContactRow | undefined> {
    const row = await this.db
      .updateTable('contacts')
      .set({ ...data, updated_at: new Date() })
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst()
    return row as ContactRow | undefined
  }

  async softDelete(id: string, organizationId: string): Promise<boolean> {
    const row = await this.db
      .updateTable('contacts')
      .set({ deleted_at: new Date(), updated_at: new Date() })
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst()
    return !!row
  }
}
