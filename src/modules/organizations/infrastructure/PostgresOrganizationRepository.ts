import { getDb } from '../../../shared/database/connection.js'
import type { OrganizationsTable } from '../../../shared/database/types.js'

export type OrganizationRow = OrganizationsTable

export interface OrganizationRepository {
  findById(id: string): Promise<OrganizationRow | undefined>
  findBySlug(slug: string): Promise<OrganizationRow | undefined>
  create(data: {
    id: string
    name: string
    slug: string
  }): Promise<OrganizationRow>
}

export class PostgresOrganizationRepository implements OrganizationRepository {
  async findById(id: string): Promise<OrganizationRow | undefined> {
    const row = await getDb()
      .selectFrom('organizations')
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return row as OrganizationRow | undefined
  }

  async findBySlug(slug: string): Promise<OrganizationRow | undefined> {
    const row = await getDb()
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
    const row = await getDb()
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
}
