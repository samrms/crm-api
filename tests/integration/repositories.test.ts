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
import { PostgresCompanyRepository } from '../../src/modules/companies/infrastructure/PostgresCompanyRepository.js'
import { PostgresContactRepository } from '../../src/modules/contacts/infrastructure/PostgresContactRepository.js'
import { PostgresLeadRepository } from '../../src/modules/leads/infrastructure/PostgresLeadRepository.js'
import { PostgresDealRepository } from '../../src/modules/deals/infrastructure/PostgresDealRepository.js'
import { OptimisticLockError } from '../../src/shared/errors/AppError.js'

describe('Integration: Database Repositories', () => {
  let orgId: string
  let userId: string

  beforeAll(async () => {
    await startTestDatabase()
  })

  afterAll(async () => {
    await stopTestDatabase()
  })

  beforeEach(async () => {
    await cleanupTestData()
    const org = await createTestOrganization()
    const user = await createTestUser()
    await createTestMembership({
      userId: user.id,
      organizationId: org.id,
      role: 'OWNER',
    })
    orgId = org.id
    userId = user.id
  })

  describe('PostgresCompanyRepository', () => {
    const repo = new PostgresCompanyRepository()

    it('creates and finds company', async () => {
      const created = await repo.create({
        id: 'co_test1',
        organizationId: orgId,
        name: 'Test Co',
      })
      expect(created.name).toBe('Test Co')

      const found = await repo.findById(created.id, orgId)
      expect(found).toBeDefined()
      expect(found!.name).toBe('Test Co')
    })

    it('returns undefined for non-existent company', async () => {
      const found = await repo.findById('co_nonexistent', orgId)
      expect(found).toBeUndefined()
    })

    it('enforces tenant isolation', async () => {
      const otherOrg = await createTestOrganization({ name: 'Other Org' })
      await repo.create({
        id: 'co_test2',
        organizationId: orgId,
        name: 'My Company',
      })

      const found = await repo.findById('co_test2', otherOrg.id)
      expect(found).toBeUndefined()
    })

    it('finds by name', async () => {
      await repo.create({
        id: 'co_test3',
        organizationId: orgId,
        name: 'Unique Name',
      })
      const found = await repo.findByName('Unique Name', orgId)
      expect(found).toBeDefined()
      expect(found!.name).toBe('Unique Name')
    })

    it('lists companies with pagination', async () => {
      await repo.create({ id: 'co_a', organizationId: orgId, name: 'A' })
      await repo.create({ id: 'co_b', organizationId: orgId, name: 'B' })
      await repo.create({ id: 'co_c', organizationId: orgId, name: 'C' })

      const list = await repo.list(orgId, { limit: 2 })
      expect(list.length).toBe(2)
    })

    it('updates company', async () => {
      const created = await repo.create({
        id: 'co_test4',
        organizationId: orgId,
        name: 'Old Name',
      })
      const updated = await repo.update(created.id, orgId, { name: 'New Name' })
      expect(updated!.name).toBe('New Name')
    })
  })

  describe('PostgresContactRepository', () => {
    const repo = new PostgresContactRepository()
    let companyId: string

    beforeEach(async () => {
      const company = await createTestCompany(orgId)
      companyId = company.id
    })

    it('creates and finds contact', async () => {
      const created = await repo.create({
        id: 'ct_test1',
        organizationId: orgId,
        companyId,
        email: 'contact@test.com',
        firstName: 'John',
        lastName: 'Doe',
      })
      expect(created.email).toBe('contact@test.com')

      const found = await repo.findById(created.id, orgId)
      expect(found).toBeDefined()
      expect(found!.email).toBe('contact@test.com')
    })

    it('finds by email within organization', async () => {
      await repo.create({
        id: 'ct_test2',
        organizationId: orgId,
        companyId,
        email: 'unique@test.com',
        firstName: 'Jane',
        lastName: 'Doe',
      })

      const found = await repo.findByEmail('unique@test.com', orgId)
      expect(found).toBeDefined()
      expect(found!.email).toBe('unique@test.com')
    })

    it('finds by email and company', async () => {
      await repo.create({
        id: 'ct_test3',
        organizationId: orgId,
        companyId,
        email: 'company@test.com',
        firstName: 'Bob',
        lastName: 'Smith',
      })

      const found = await repo.findByEmailAndCompany(
        'company@test.com',
        companyId,
        orgId,
      )
      expect(found).toBeDefined()
      expect(found!.company_id).toBe(companyId)
    })

    it('enforces tenant isolation', async () => {
      const otherOrg = await createTestOrganization({ name: 'Other Org' })
      await repo.create({
        id: 'ct_test4',
        organizationId: orgId,
        companyId,
        email: 'tenant@test.com',
        firstName: 'Test',
        lastName: 'User',
      })

      const found = await repo.findByEmail('tenant@test.com', otherOrg.id)
      expect(found).toBeUndefined()
    })
  })

  describe('PostgresLeadRepository', () => {
    const repo = new PostgresLeadRepository()

    it('creates lead with default NEW status', async () => {
      const created = await repo.create({
        id: 'ld_test1',
        organizationId: orgId,
        email: 'lead@test.com',
        firstName: 'Lead',
        lastName: 'User',
      })
      expect(created.status).toBe('NEW')
      expect(created.version).toBe(1)
    })

    it('updates status with optimistic locking', async () => {
      const created = await repo.create({
        id: 'ld_test2',
        organizationId: orgId,
        email: 'lock@test.com',
        firstName: 'Lock',
        lastName: 'Test',
      })

      const updated = await repo.updateStatus(created.id, orgId, 'CONTACTED', 1)
      expect(updated).toBeDefined()
      expect(updated!.status).toBe('CONTACTED')
      expect(updated!.version).toBe(2)
    })

    it('throws OptimisticLockError on version mismatch', async () => {
      const created = await repo.create({
        id: 'ld_test3',
        organizationId: orgId,
        email: 'optimistic@test.com',
        firstName: 'Optimistic',
        lastName: 'Lock',
      })

      await repo.updateStatus(created.id, orgId, 'CONTACTED', 1)

      await expect(
        repo.updateStatus(created.id, orgId, 'QUALIFIED', 1),
      ).rejects.toThrow(OptimisticLockError)
    })
  })

  describe('PostgresDealRepository', () => {
    const repo = new PostgresDealRepository()
    let companyId: string
    let contactId: string

    beforeEach(async () => {
      const company = await createTestCompany(orgId)
      const contact = await createTestContact(orgId, company.id)
      companyId = company.id
      contactId = contact.id
    })

    it('creates deal with default NEW stage', async () => {
      const created = await repo.create({
        id: 'dl_test1',
        organizationId: orgId,
        title: 'Test Deal',
        companyId,
        contactId,
      })
      expect(created.stage).toBe('NEW')
      expect(created.version).toBe(1)
    })

    it('updates stage with optimistic locking', async () => {
      const created = await repo.create({
        id: 'dl_test2',
        organizationId: orgId,
        title: 'Lock Deal',
        companyId,
        contactId,
      })

      const updated = await repo.updateStage(created.id, orgId, 'QUALIFIED', 1)
      expect(updated).toBeDefined()
      expect(updated!.stage).toBe('QUALIFIED')
      expect(updated!.version).toBe(2)
    })

    it('throws OptimisticLockError on version mismatch', async () => {
      const created = await repo.create({
        id: 'dl_test3',
        organizationId: orgId,
        title: 'Optimistic Deal',
        companyId,
        contactId,
      })

      await repo.updateStage(created.id, orgId, 'QUALIFIED', 1)

      await expect(
        repo.updateStage(created.id, orgId, 'PROPOSAL', 1),
      ).rejects.toThrow(OptimisticLockError)
    })
  })
})
