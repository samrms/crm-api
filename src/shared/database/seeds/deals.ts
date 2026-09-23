import { faker } from '@faker-js/faker'
import type { Kysely } from 'kysely'
import type { Database } from '@/shared/database/types.js'
import { newId } from '@/shared/utils/id.js'

const DEAL_STAGES = [
  'NEW',
  'NEW',
  'QUALIFIED',
  'QUALIFIED',
  'PROPOSAL',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
] as const

export async function seedDeals(
  db: Kysely<Database>,
  orgId: string,
  companyIds: string[],
  contactIds: string[],
): Promise<string[]> {
  const now = new Date()
  const dealIds: string[] = []
  for (const stage of DEAL_STAGES) {
    const dealId = newId('dl')
    await db
      .insertInto('deals')
      .values({
        id: dealId,
        organization_id: orgId,
        companyId: faker.helpers.arrayElement(companyIds),
        contactId: faker.helpers.arrayElement(contactIds),
        title: `${faker.commerce.productName()} deal`,
        value: faker.number.int({ min: 1000, max: 100000 }),
        currency: 'USD',
        stage,
        created_at: faker.date.past({ years: 1 }),
        updated_at: now,
        version: 1,
      })
      .execute()
    dealIds.push(dealId)
  }
  return dealIds
}
