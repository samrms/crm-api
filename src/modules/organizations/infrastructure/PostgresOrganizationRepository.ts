import type { Kysely } from 'kysely'
import type { OrganizationsTable, Database } from '@/shared/database/types.js'

export type OrganizationRow = OrganizationsTable

export interface OrganizationRepository {
  findById(id: string): Promise<OrganizationRow | undefined>
  findBySlug(slug: string): Promise<OrganizationRow | undefined>
  create(data: {
    id: string
    name: string
    slug: string
  }): Promise<OrganizationRow>
  update(
    id: string,
    data: { name?: string; slug?: string },
  ): Promise<OrganizationRow | undefined>
  softDelete(id: string): Promise<boolean>
}

export class PostgresOrganizationRepository implements OrganizationRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(id: string): Promise<OrganizationRow | undefined> {
    const row = await this.db
      .selectFrom('organizations')
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return row as OrganizationRow | undefined
  }

  async findBySlug(slug: string): Promise<OrganizationRow | undefined> {
    const row = await this.db
      .selectFrom('organizations')
      .where('slug', '=', slug)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return row as OrganizationRow | undefined
  }

  async create(data: {
    id: string
    name: string
    slug: string
  }): Promise<OrganizationRow> {
    const now = new Date()
    const row = await this.db
      .insertInto('organizations')
      .values({
        id: data.id,
        name: data.name,
        slug: data.slug,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    return row as OrganizationRow
  }

  async update(
    id: string,
    data: { name?: string; slug?: string },
  ): Promise<OrganizationRow | undefined> {
    const values: Record<string, string | Date> = { updated_at: new Date() }
    if (data.name !== undefined) values.name = data.name
    if (data.slug !== undefined) values.slug = data.slug

    const row = await this.db
      .updateTable('organizations')
      .set(values)
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst()
    return row as OrganizationRow | undefined
  }

  async softDelete(id: string): Promise<boolean> {
    const row = await this.db
      .updateTable('organizations')
      .set({ deleted_at: new Date(), updated_at: new Date() })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst()
    return !!row
  }
}
