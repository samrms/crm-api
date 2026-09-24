import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  startTestDatabase,
  stopTestDatabase,
  getTestDb,
} from '../fixtures/testDatabase.js'
import {
  cleanupTestData,
  createTestCompany,
  createTestOrganization,
} from '../fixtures/factories.js'
import { PostgresCompanyRepository } from '../../src/modules/crm/companies/infrastructure/PostgresCompanyRepository.js'

beforeAll(startTestDatabase)
afterAll(stopTestDatabase)
beforeEach(cleanupTestData)

describe('Postgres repositories (sqlite harness)', () => {
  it('returns undefined when reading another organization row', async () => {
    const db = getTestDb()
    const repo = new PostgresCompanyRepository(db)
    const orgA = await createTestOrganization()
    const orgB = await createTestOrganization()
    const company = await createTestCompany(orgA.id)

    expect(await repo.findById(company.id, orgA.id)).toBeDefined()
    expect(await repo.findById(company.id, orgB.id)).toBeUndefined()
  })

  it('lists only rows belonging to the organization', async () => {
    const db = getTestDb()
    const repo = new PostgresCompanyRepository(db)
    const orgA = await createTestOrganization()
    const orgB = await createTestOrganization()
    await createTestCompany(orgA.id)
    await createTestCompany(orgA.id)
    await createTestCompany(orgB.id)

    expect(await repo.list(orgA.id, { limit: 10 })).toHaveLength(2)
    expect(await repo.list(orgB.id, { limit: 10 })).toHaveLength(1)
  })

  it('soft delete hides the row from subsequent reads', async () => {
    const db = getTestDb()
    const repo = new PostgresCompanyRepository(db)
    const org = await createTestOrganization()
    const company = await createTestCompany(org.id)

    expect(await repo.softDelete(company.id, org.id)).toBe(true)
    expect(await repo.findById(company.id, org.id)).toBeUndefined()
    expect(await repo.softDelete(company.id, org.id)).toBe(false)
  })

  it('updates only rows inside the organization', async () => {
    const db = getTestDb()
    const repo = new PostgresCompanyRepository(db)
    const orgA = await createTestOrganization()
    const orgB = await createTestOrganization()
    const company = await createTestCompany(orgA.id, { name: 'Original' })

    const updated = await repo.update(company.id, orgB.id, {
      name: 'Hijacked',
    })
    expect(updated).toBeUndefined()
    expect((await repo.findById(company.id, orgA.id))?.name).toBe('Original')
  })
})
