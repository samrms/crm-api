import { faker } from '@faker-js/faker'
import type { Kysely } from 'kysely'
import type { Database } from '@/shared/database/types.js'
import { newId } from '@/shared/utils/id.js'

export async function seedContacts(
  db: Kysely<Database>,
  orgId: string,
  companyIds: string[],
): Promise<string[]> {
  const now = new Date()
  const contactIds: string[] = []
  for (let i = 0; i < 15; i++) {
    const contactId = newId('ct')
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    await db
      .insertInto('contacts')
      .values({
        id: contactId,
        organization_id: orgId,
        company_id: faker.helpers.arrayElement(companyIds),
        email: faker.internet.email({ firstName, lastName }),
        firstName,
        lastName,
        title: faker.person.jobTitle(),
        created_at: faker.date.past({ years: 1 }),
        updated_at: now,
      })
      .execute()
    contactIds.push(contactId)
  }
  return contactIds
}
