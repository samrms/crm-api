import { nanoid } from 'nanoid'
import { getDb } from '../database/connection.js'

export interface AuditEvent {
  organizationId: string
  actorId: string
  action: string
  resourceType: string
  resourceId?: string
  requestId?: string
  metadata?: Record<string, unknown>
}

export async function recordAudit(event: AuditEvent): Promise<void> {
  await getDb()
    .insertInto('audit_events')
    .values({
      id: `aud_${nanoid(12)}`,
      organization_id: event.organizationId,
      actor_id: event.actorId,
      action: event.action,
      resource_type: event.resourceType,
      resource_id: event.resourceId ?? null,
      request_id: event.requestId ?? null,
      metadata: event.metadata ?? null,
      created_at: new Date(),
    })
    .execute()
}
