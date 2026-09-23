import { faker } from '@faker-js/faker'
import type { Kysely } from 'kysely'
import type { Database } from '@/shared/database/types.js'
import { newId } from '@/shared/utils/id.js'

export async function seedActivities(
  db: Kysely<Database>,
  orgId: string,
  dealIds: string[],
  contactIds: string[],
): Promise<void> {
  const now = new Date()
  for (const type of ['CALL', 'EMAIL', 'MEETING', 'NOTE'] as const) {
    await db
      .insertInto('activities')
      .values({
        id: newId('act'),
        organization_id: orgId,
        dealId: faker.helpers.arrayElement(dealIds),
        contactId: faker.helpers.arrayElement(contactIds),
        type,
        subject: `${type.toLowerCase()} notes`,
        body: faker.lorem.sentence(),
        occurredAt: faker.date.recent({ days: 30 }),
        created_at: now,
        updated_at: now,
      })
      .execute()
  }
}
