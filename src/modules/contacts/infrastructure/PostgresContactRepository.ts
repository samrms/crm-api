import { getDb } from '../../../shared/database/connection.js'
import type { ContactsTable } from '../../../shared/database/types.js'

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
  }): Promise<ContactRow>
}

export class PostgresContactRepository implements ContactRepository {
  async findById(
    id: string,
    organizationId: string,
  ): Promise<ContactRow | undefined> {
    const row = await getDb()
      .selectFrom('contacts')
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
    const row = await getDb()
      .selectFrom('contacts')
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
    const row = await getDb()
      .selectFrom('contacts')
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
    let query = getDb()
      .selectFrom('contacts')
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
  }): Promise<ContactRow> {
    const now = new Date()
    const row = await getDb()
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
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    return row as ContactRow
  }
}
