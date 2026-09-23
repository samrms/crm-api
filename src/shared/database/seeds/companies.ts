import { faker } from '@faker-js/faker'
import type { Kysely } from 'kysely'
import type { Database } from '@/shared/database/types.js'
import { newId } from '@/shared/utils/id.js'

export async function seedCompanies(
  db: Kysely<Database>,
  orgId: string,
): Promise<string[]> {
  const now = new Date()
  const companyIds: string[] = []
  for (let i = 0; i < 8; i++) {
    const companyId = newId('co')
    const name = faker.company.name()
    await db
      .insertInto('companies')
      .values({
        id: companyId,
        organization_id: orgId,
        name,
        domain: faker.internet.domainName(),
        industry: faker.commerce.department(),
        created_at: faker.date.past({ years: 1 }),
        updated_at: now,
      })
      .execute()
    companyIds.push(companyId)
  }
  return companyIds
}
