import type { Kysely } from 'kysely'
import type { AuditEventsTable, Database } from '@/shared/database/types.js'

export type AuditEventRow = AuditEventsTable

export interface AuditRepository {
  findById(
    id: string,
    organizationId: string,
  ): Promise<AuditEventRow | undefined>
  list(
    organizationId: string,
    opts: {
      limit: number
      after?: string
      resourceType?: string
      resourceId?: string
    },
  ): Promise<AuditEventRow[]>
  create(data: {
    id: string
    organizationId: string
    actorId: string
    action: string
    resourceType: string
    resourceId?: string
    requestId?: string
    metadata?: Record<string, unknown>
  }): Promise<AuditEventRow>
}

export class PostgresAuditRepository implements AuditRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(
    id: string,
    organizationId: string,
  ): Promise<AuditEventRow | undefined> {
    const row = await this.db
      .selectFrom('audit_events')
      .selectAll()
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .executeTakeFirst()
    return row as AuditEventRow | undefined
  }

  async list(
    organizationId: string,
    opts: {
      limit: number
      after?: string
      resourceType?: string
      resourceId?: string
    },
  ): Promise<AuditEventRow[]> {
    let query = this.db
      .selectFrom('audit_events')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(opts.limit + 1)

    if (opts.resourceType) {
      query = query.where('resource_type', '=', opts.resourceType)
    }
    if (opts.resourceId) {
      query = query.where('resource_id', '=', opts.resourceId)
    }

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
    return rows as AuditEventRow[]
  }

  async create(data: {
    id: string
    organizationId: string
    actorId: string
    action: string
    resourceType: string
    resourceId?: string
    requestId?: string
    metadata?: Record<string, unknown>
  }): Promise<AuditEventRow> {
    const row = await this.db
      .insertInto('audit_events')
      .values({
        id: data.id,
        organization_id: data.organizationId,
        actor_id: data.actorId,
        action: data.action,
        resource_type: data.resourceType,
        resource_id: data.resourceId ?? null,
        request_id: data.requestId ?? null,
        metadata: data.metadata ?? null,
        created_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    return row as AuditEventRow
  }
}
