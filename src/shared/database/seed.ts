import { faker } from '@faker-js/faker'
import { database } from './connection.js'
import { config } from '@/shared/config.js'
import { logger } from '@/shared/logging/logger.js'
import { seedOrganizations } from './seeds/organizations.js'
import { seedUsers, OWNER_EMAIL } from './seeds/users.js'
import { seedCompanies } from './seeds/companies.js'
import { seedContacts } from './seeds/contacts.js'
import { seedLeads } from './seeds/leads.js'
import { seedDeals } from './seeds/deals.js'

export class DemoSeeder {
  async run(): Promise<void> {
    faker.seed(42)
    const db = database.db

    for (const table of [
      'sessions',
      'memberships',
      'deals',
      'leads',
      'contacts',
      'companies',
      'users',
      'organizations',
    ] as const) {
      await db.deleteFrom(table).execute()
    }

    const { orgId } = await seedOrganizations(db)
    await seedUsers(db, orgId)
    const companyIds = await seedCompanies(db, orgId)
    const contactIds = await seedContacts(db, orgId, companyIds)
    await seedLeads(db, orgId)
    await seedDeals(db, orgId, companyIds, contactIds)

    logger.info(
      { organizationId: orgId, email: OWNER_EMAIL },
      'Demo data seeded. Login with owner@acme.test / secret1234 (development only).',
    )
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  if (config.nodeEnv === 'production') {
    logger.error('Refusing to seed the production database')
    process.exit(1)
  }
  new DemoSeeder()
    .run()
    .then(async () => {
      await database.close()
      process.exit(0)
    })
    .catch(async (err) => {
      logger.error({ err }, 'Seed failed')
      await database.close()
      process.exit(1)
    })
}
