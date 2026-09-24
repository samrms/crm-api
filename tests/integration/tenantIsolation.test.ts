import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  getTestDb,
  startTestDatabase,
  stopTestDatabase,
} from '../fixtures/testDatabase.js'
import {
  cleanupTestData,
  createTestCompany,
  createTestContact,
  createTestDeal,
  createTestLead,
  createTestOrganization,
  createTestUser,
} from '../fixtures/factories.js'

beforeAll(startTestDatabase)
afterAll(stopTestDatabase)
beforeEach(cleanupTestData)

describe('tenant isolation at the data layer', () => {
  it('companies are scoped to their organization', async () => {
    const db = getTestDb()
    const orgA = await createTestOrganization({ name: 'Org A' })
    const orgB = await createTestOrganization({ name: 'Org B' })
    await createTestCompany(orgA.id, { name: 'Org A Company' })
    await createTestCompany(orgB.id, { name: 'Org B Company' })

    const rowsA = await db
      .selectFrom('companies')
      .selectAll()
      .where('organization_id', '=', orgA.id)
      .execute()
    expect(rowsA).toHaveLength(1)
    expect(rowsA[0]!.name).toBe('Org A Company')
  })

  it('contacts, leads and deals are scoped to their organization', async () => {
    const db = getTestDb()
    const orgA = await createTestOrganization()
    const orgB = await createTestOrganization()
    const company = await createTestCompany(orgA.id)
    await createTestContact(orgA.id, company.id, {
      email: 'contact-a@example.com',
    })
    await createTestContact(orgB.id, null, { email: 'contact-b@example.com' })
    await createTestLead(orgA.id, { email: 'lead-a@example.com' })
    await createTestLead(orgB.id, { email: 'lead-b@example.com' })
    await createTestDeal(orgA.id, { title: 'Deal A' })
    await createTestDeal(orgB.id, { title: 'Deal B' })

    for (const [table, column, expected] of [
      ['contacts', 'email', 'contact-a@example.com'],
      ['leads', 'email', 'lead-a@example.com'],
      ['deals', 'title', 'Deal A'],
    ] as const) {
      const rowsA = await db
        .selectFrom(table)
        .selectAll()
        .where('organization_id', '=', orgA.id)
        .execute()
      expect(rowsA).toHaveLength(1)
      expect(rowsA[0]![column]).toBe(expected)
    }
  })

  it('memberships enforce one row per user and organization', async () => {
    const db = getTestDb()
    const org = await createTestOrganization()
    const user = await createTestUser()
    const values = {
      user_id: user.id,
      organization_id: org.id,
      created_at: new Date(),
      updated_at: new Date(),
    }
    await db
      .insertInto('memberships')
      .values({ id: 'mem_1', role: 'OWNER', ...values })
      .execute()
    await expect(
      db
        .insertInto('memberships')
        .values({ id: 'mem_2', role: 'ADMIN', ...values })
        .execute(),
    ).rejects.toThrow()
  })

  it('membership roles are constrained to valid values', async () => {
    const db = getTestDb()
    const org = await createTestOrganization()
    const user = await createTestUser()
    await expect(
      db
        .insertInto('memberships')
        .values({
          id: 'mem_bad',
          user_id: user.id,
          organization_id: org.id,
          role: 'INVALID_ROLE' as never,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute(),
    ).rejects.toThrow()
  })
})
