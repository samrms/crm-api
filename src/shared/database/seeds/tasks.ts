import { faker } from '@faker-js/faker'
import type { Kysely } from 'kysely'
import type { Database } from '@/shared/database/types.js'
import { newId } from '@/shared/utils/id.js'

const TASK_STATUSES = [
  'PENDING',
  'PENDING',
  'PENDING',
  'IN_PROGRESS',
  'IN_PROGRESS',
  'COMPLETED',
  'COMPLETED',
  'PENDING',
  'IN_PROGRESS',
  'CANCELLED',
] as const

export async function seedTasks(
  db: Kysely<Database>,
  orgId: string,
  dealIds: string[],
  leadIds: string[],
  memberIds: string[],
): Promise<void> {
  const now = new Date()
  for (const status of TASK_STATUSES) {
    await db
      .insertInto('tasks')
      .values({
        id: newId('task'),
        organization_id: orgId,
        dealId: faker.helpers.arrayElement(dealIds),
        leadId: faker.helpers.arrayElement(leadIds),
        title: `Follow up: ${faker.commerce.productName()}`,
        status,
        dueDate: faker.date.soon({ days: 14 }),
        assignedToId: faker.helpers.arrayElement(memberIds),
        created_at: now,
        updated_at: now,
      })
      .execute()
  }
}
