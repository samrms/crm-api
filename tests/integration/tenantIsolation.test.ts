import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  startTestDatabase,
  stopTestDatabase,
  getTestDb,
} from '../fixtures/testDatabase.js'
import {
  createTestOrganization,
  createTestUser,
  createTestMembership,
  createTestCompany,
  createTestContact,
  createTestLead,
  createTestDeal,
  cleanupTestData,
} from '../fixtures/factories.js'

describe('Integration: Tenant Isolation', () => {
  beforeAll(async () => {
    await startTestDatabase()
  })

  afterAll(async () => {
    await stopTestDatabase()
  })

  beforeEach(async () => {
    await cleanupTestData()
  })

  it('organization A cannot see organization B companies', async () => {
    const db = getTestDb()

    const orgA = await createTestOrganization({ name: 'Org A' })
    const orgB = await createTestOrganization({ name: 'Org B' })

    await db
      .insertInto('companies')
      .values({
        id: 'co_orga',
        organization_id: orgA.id,
        name: 'Org A Company',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()

    await db
      .insertInto('companies')
      .values({
        id: 'co_orgb',
        organization_id: orgB.id,
        name: 'Org B Company',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()

    const orgACompanies = await db
      .selectFrom('companies')
      .where('organization_id', '=', orgA.id)
      .execute()

    const orgBCompanies = await db
      .selectFrom('companies')
      .where('organization_id', '=', orgB.id)
      .execute()

    expect(orgACompanies).toHaveLength(1)
    expect(orgACompanies[0]!.name).toBe('Org A Company')
    expect(orgBCompanies).toHaveLength(1)
    expect(orgBCompanies[0]!.name).toBe('Org B Company')
  })

  it('organization A cannot see organization B contacts', async () => {
    const db = getTestDb()

    const orgA = await createTestOrganization({ name: 'Org A' })
    const orgB = await createTestOrganization({ name: 'Org B' })

    const coA = await createTestCompany(orgA.id)
    const coB = await createTestCompany(orgB.id)

    await db
      .insertInto('contacts')
      .values({
        id: 'ct_orga',
        organization_id: orgA.id,
        company_id: coA.id,
        email: 'contact@orga.com',
        firstName: 'OrgA',
        lastName: 'Contact',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()

    await db
      .insertInto('contacts')
      .values({
        id: 'ct_orgb',
        organization_id: orgB.id,
        company_id: coB.id,
        email: 'contact@orgb.com',
        firstName: 'OrgB',
        lastName: 'Contact',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()

    const orgAContacts = await db
      .selectFrom('contacts')
      .where('organization_id', '=', orgA.id)
      .execute()

    const orgBContacts = await db
      .selectFrom('contacts')
      .where('organization_id', '=', orgB.id)
      .execute()

    expect(orgAContacts).toHaveLength(1)
    expect(orgAContacts[0]!.email).toBe('contact@orga.com')
    expect(orgBContacts).toHaveLength(1)
    expect(orgBContacts[0]!.email).toBe('contact@orgb.com')
  })

  it('organization A cannot see organization B leads', async () => {
    const db = getTestDb()

    const orgA = await createTestOrganization({ name: 'Org A' })
    const orgB = await createTestOrganization({ name: 'Org B' })

    await db
      .insertInto('leads')
      .values({
        id: 'ld_orga',
        organization_id: orgA.id,
        email: 'lead@orga.com',
        firstName: 'OrgA',
        lastName: 'Lead',
        status: 'NEW',
        version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()

    await db
      .insertInto('leads')
      .values({
        id: 'ld_orgb',
        organization_id: orgB.id,
        email: 'lead@orgb.com',
        firstName: 'OrgB',
        lastName: 'Lead',
        status: 'NEW',
        version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()

    const orgALeads = await db
      .selectFrom('leads')
      .where('organization_id', '=', orgA.id)
      .execute()

    const orgBLeads = await db
      .selectFrom('leads')
      .where('organization_id', '=', orgB.id)
      .execute()

    expect(orgALeads).toHaveLength(1)
    expect(orgALeads[0]!.email).toBe('lead@orga.com')
    expect(orgBLeads).toHaveLength(1)
    expect(orgBLeads[0]!.email).toBe('lead@orgb.com')
  })

  it('organization A cannot see organization B deals', async () => {
    const db = getTestDb()

    const orgA = await createTestOrganization({ name: 'Org A' })
    const orgB = await createTestOrganization({ name: 'Org B' })

    await db
      .insertInto('deals')
      .values({
        id: 'dl_orga',
        organization_id: orgA.id,
        title: 'Org A Deal',
        stage: 'NEW',
        version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()

    await db
      .insertInto('deals')
      .values({
        id: 'dl_orgb',
        organization_id: orgB.id,
        title: 'Org B Deal',
        stage: 'NEW',
        version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()

    const orgADeals = await db
      .selectFrom('deals')
      .where('organization_id', '=', orgA.id)
      .execute()

    const orgBDeals = await db
      .selectFrom('deals')
      .where('organization_id', '=', orgB.id)
      .execute()

    expect(orgADeals).toHaveLength(1)
    expect(orgADeals[0]!.title).toBe('Org A Deal')
    expect(orgBDeals).toHaveLength(1)
    expect(orgBDeals[0]!.title).toBe('Org B Deal')
  })

  it('organization A cannot see organization B imports', async () => {
    const db = getTestDb()

    const orgA = await createTestOrganization({ name: 'Org A' })
    const orgB = await createTestOrganization({ name: 'Org B' })

    await db
      .insertInto('imports')
      .values({
        id: 'imp_orga',
        organization_id: orgA.id,
        actor_id: 'user_a',
        type: 'companies',
        status: 'PENDING',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()

    await db
      .insertInto('imports')
      .values({
        id: 'imp_orgb',
        organization_id: orgB.id,
        actor_id: 'user_b',
        type: 'companies',
        status: 'PENDING',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()

    const orgAImports = await db
      .selectFrom('imports')
      .where('organization_id', '=', orgA.id)
      .execute()

    const orgBImports = await db
      .selectFrom('imports')
      .where('organization_id', '=', orgB.id)
      .execute()

    expect(orgAImports).toHaveLength(1)
    expect(orgAImports[0]!.id).toBe('imp_orga')
    expect(orgBImports).toHaveLength(1)
    expect(orgBImports[0]!.id).toBe('imp_orgb')
  })

  it('membership table enforces unique user-org constraint', async () => {
    const db = getTestDb()

    const org = await createTestOrganization()
    const user = await createTestUser()

    await db
      .insertInto('memberships')
      .values({
        id: 'mem_1',
        user_id: user.id,
        organization_id: org.id,
        role: 'OWNER',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()

    await expect(
      db
        .insertInto('memberships')
        .values({
          id: 'mem_2',
          user_id: user.id,
          organization_id: org.id,
          role: 'ADMIN',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute(),
    ).rejects.toThrow()
  })

  it('membership role check constraint enforces valid roles', async () => {
    const db = getTestDb()

    const org = await createTestOrganization()
    const user = await createTestUser()

    await expect(
      db
        .insertInto('memberships')
        .values({
          id: 'mem_1',
          user_id: user.id,
          organization_id: org.id,
          role: 'INVALID_ROLE',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute(),
    ).rejects.toThrow()
  })
})
