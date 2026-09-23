import { faker } from '@faker-js/faker'
import type { Kysely } from 'kysely'
import type { Database } from '@/shared/database/types.js'
import { newId } from '@/shared/utils/id.js'

const LEAD_STATUSES = [
  'NEW',
  'NEW',
  'NEW',
  'NEW',
  'CONTACTED',
  'CONTACTED',
  'CONTACTED',
  'CONTACTED',
  'QUALIFIED',
  'QUALIFIED',
  'QUALIFIED',
  'QUALIFIED',
] as const

export async function seedLeads(
  db: Kysely<Database>,
  orgId: string,
): Promise<string[]> {
  const now = new Date()
  const leadIds: string[] = []
  for (const status of LEAD_STATUSES) {
    const leadId = newId('ld')
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    await db
      .insertInto('leads')
      .values({
        id: leadId,
        organization_id: orgId,
        email: faker.internet.email({ firstName, lastName }),
        firstName,
        lastName,
        company: faker.company.name(),
        source: faker.helpers.arrayElement(['website', 'referral', 'event']),
        status,
        created_at: faker.date.past({ years: 1 }),
        updated_at: now,
        version: 1,
      })
      .execute()
    leadIds.push(leadId)
  }
  return leadIds
}
