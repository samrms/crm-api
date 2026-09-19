import { getDb } from '../../../shared/database/connection.js'
import type { ActivitiesTable } from '../../../shared/database/types.js'

export type ActivityRow = ActivitiesTable

export interface ActivityRepository {
  create(data: {
    id: string
    organizationId: string
    type: ActivityRow['type']
    subject: string
    body?: string
    dealId?: string
    leadId?: string
    contactId?: string
    companyId?: string
  }): Promise<ActivityRow>
  listByDeal(dealId: string, organizationId: string): Promise<ActivityRow[]>
}

export class PostgresActivityRepository implements ActivityRepository {
  async create(data: {
    id: string
    organizationId: string
    type: ActivityRow['type']
    subject: string
    body?: string
    dealId?: string
    leadId?: string
    contactId?: string
    companyId?: string
  }): Promise<ActivityRow> {
    const now = new Date()
    const row = await getDb()
      .insertInto('activities')
      .values({
        id: data.id,
        organization_id: data.organizationId,
        type: data.type,
        subject: data.subject,
        body: data.body ?? null,
        dealId: data.dealId ?? null,
        leadId: data.leadId ?? null,
        contactId: data.contactId ?? null,
        companyId: data.companyId ?? null,
        occurredAt: now,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    return row as ActivityRow
  }

  async listByDeal(
    dealId: string,
    organizationId: string,
  ): Promise<ActivityRow[]> {
    const rows = await getDb()
      .selectFrom('activities')
      .where('dealId', '=', dealId)
      .where('organization_id', '=', organizationId)
      .orderBy('occurredAt', 'desc')
      .execute()
    return rows as ActivityRow[]
  }
}
