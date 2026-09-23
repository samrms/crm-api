import { faker } from '@faker-js/faker'
import { hashPassword } from '@/shared/auth/password.js'
import { getDb, closeDatabase } from './connection.js'
import { config } from '@/shared/config.js'
import { logger } from '@/shared/logging/logger.js'
import { newId } from '@/shared/utils/id.js'
import { toSlug } from '@/shared/utils/slug.js'

const OWNER_EMAIL = 'owner@acme.test'
const OWNER_PASSWORD = 'secret1234'

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

export async function seedDemoData(): Promise<void> {
  faker.seed(42)
  const db = getDb()
  const now = new Date()

  for (const table of [
    'sessions',
    'memberships',
    'activities',
    'tasks',
    'deals',
    'leads',
    'contacts',
    'companies',
    'users',
    'organizations',
  ] as const) {
    await db.deleteFrom(table).execute()
  }

  const orgId = newId('org')
  const orgName = 'Acme'
  await db
    .insertInto('organizations')
    .values({
      id: orgId,
      name: orgName,
      slug: toSlug(orgName),
      created_at: now,
      updated_at: now,
    })
    .execute()

  const passwordHash = await hashPassword(OWNER_PASSWORD)
  const ownerId = newId('user')
  await db
    .insertInto('users')
    .values({
      id: ownerId,
      email: OWNER_EMAIL,
      name: 'Owner',
      password_hash: passwordHash,
      created_at: now,
      updated_at: now,
    })
    .execute()
  await db
    .insertInto('memberships')
    .values({
      id: newId('mem'),
      user_id: ownerId,
      organization_id: orgId,
      role: 'OWNER',
      created_at: now,
      updated_at: now,
    })
    .execute()

  const memberPasswordHash = await hashPassword(OWNER_PASSWORD)
  const memberIds: string[] = []
  for (const [email, name, role] of [
    ['admin@acme.test', 'Admin', 'ADMIN'],
    ['member@acme.test', 'Member', 'MEMBER'],
  ] as const) {
    const userId = newId('user')
    await db
      .insertInto('users')
      .values({
        id: userId,
        email,
        name,
        password_hash: memberPasswordHash,
        created_at: now,
        updated_at: now,
      })
      .execute()
    await db
      .insertInto('memberships')
      .values({
        id: newId('mem'),
        user_id: userId,
        organization_id: orgId,
        role,
        created_at: now,
        updated_at: now,
      })
      .execute()
    memberIds.push(userId)
  }

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

  logger.info(
    { organizationId: orgId, email: OWNER_EMAIL },
    'Demo data seeded. Login with owner@acme.test / secret1234 (development only).',
  )
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  if (config.nodeEnv === 'production') {
    logger.error('Refusing to seed the production database')
    process.exit(1)
  }
  seedDemoData()
    .then(async () => {
      await closeDatabase()
      process.exit(0)
    })
    .catch(async (err) => {
      logger.error({ err }, 'Seed failed')
      await closeDatabase()
      process.exit(1)
    })
}
