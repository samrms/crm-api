import { nanoid } from 'nanoid'
import { getDb } from '../database/connection.js'

export interface OutboxEvent {
  organizationId: string
  type: string
  payload: Record<string, unknown>
}

export async function writeOutboxEvent(event: OutboxEvent): Promise<void> {
  await getDb()
    .insertInto('outbox_events')
    .values({
      id: `ob_${nanoid(12)}`,
      organization_id: event.organizationId,
      type: event.type,
      payload: event.payload,
      created_at: new Date(),
    })
    .execute()
}

export async function dispatchPendingEvents(limit = 10): Promise<number> {
  const db = getDb()

  const events = await db
    .selectFrom('outbox_events')
    .where('processed_at', 'is', null)
    .orderBy('created_at', 'asc')
    .limit(limit)
    .execute()

  if (events.length === 0) return 0

  // In a real system, publish to BullMQ here
  // For now, mark as processed
  for (const event of events) {
    await db
      .updateTable('outbox_events')
      .set({ processed_at: new Date() })
      .where('id', '=', (event as { id: string }).id)
      .execute()
  }

  return events.length
}
