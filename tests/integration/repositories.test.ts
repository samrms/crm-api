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
  cleanupTestData,
} from '../fixtures/factories.js'
import { PostgresCompanyRepository } from '../../src/modules/crm/companies/infrastructure/PostgresCompanyRepository.js'
import { PostgresContactRepository } from '../../src/modules/crm/contacts/infrastructure/PostgresContactRepository.js'
import { PostgresLeadRepository } from '../../src/modules/crm/leads/infrastructure/PostgresLeadRepository.js'
import { PostgresDealRepository } from '../../src/modules/crm/deals/infrastructure/PostgresDealRepository.js'

describe('Integration: Database Repositories', () => {
  let orgId: string
  let repoCompany: PostgresCompanyRepository
  let repoContact: PostgresContactRepository
  let repoLead: PostgresLeadRepository
  let repoDeal: PostgresDealRepository

  beforeAll(async () => {
    await startTestDatabase()
    repoCompany = new PostgresCompanyRepository(getTestDb())
    repoContact = new PostgresContactRepository(getTestDb())
    repoLead = new PostgresLeadRepository(getTestDb())
    repoDeal = new PostgresDealRepository(getTestDb())
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
  })

  describe('PostgresCompanyRepository', () => {
    it('creates and finds company', async () => {
      const created = await repoCompany.create({
        id: 'co_test1',
        organizationId: orgId,
        name: 'Test Co',
      })
      expect(created.name).toBe('Test Co')
      const found = await repoCompany.findById(created.id, orgId)
      expect(found).toBeDefined()
      expect(found!.name).toBe('Test Co')
    })
    it('returns undefined for non-existent company', async () => {
      const found = await repoCompany.findById('co_nonexistent', orgId)
      expect(found).toBeUndefined()
    })
    it('enforces tenant isolation', async () => {
      const otherOrg = await createTestOrganization({ name: 'Other Org' })
      await repoCompany.create({
        id: 'co_test2',
        organizationId: orgId,
        name: 'My Company',
      })
      const found = await repoCompany.findById('co_test2', otherOrg.id)
      expect(found).toBeUndefined()
    })
    it('finds by name', async () => {
      await repoCompany.create({
        id: 'co_test3',
        organizationId: orgId,
        name: 'Unique Name',
      })
      const found = await repoCompany.findByName('Unique Name', orgId)
      expect(found).toBeDefined()
      expect(found!.name).toBe('Unique Name')
    })
    it('lists companies with pagination', async () => {
      await repoCompany.create({ id: 'co_a', organizationId: orgId, name: 'A' })
      await repoCompany.create({ id: 'co_b', organizationId: orgId, name: 'B' })
      await repoCompany.create({ id: 'co_c', organizationId: orgId, name: 'C' })
      const list = await repoCompany.list(orgId, { limit: 2 })
      expect(list.length).toBe(2)
    })
    it('updates company', async () => {
      const created = await repoCompany.create({
        id: 'co_test4',
        organizationId: orgId,
        name: 'Old Name',
      })
      const updated = await repoCompany.update(created.id, orgId, {
        name: 'New Name',
      })
      expect(updated!.name).toBe('New Name')
    })
  })

  describe('PostgresContactRepository', () => {
    let companyId: string
    beforeEach(async () => {
      const company = await createTestCompany(orgId)
      companyId = company.id
    })
    it('creates and finds contact', async () => {
      const created = await repoContact.create({
        id: 'ct_test1',
        organizationId: orgId,
        companyId,
        email: 'contact@test.com',
        firstName: 'John',
        lastName: 'Doe',
      })
      expect(created.email).toBe('contact@test.com')
      const found = await repoContact.findById(created.id, orgId)
      expect(found).toBeDefined()
      expect(found!.email).toBe('contact@test.com')
    })
    it('finds by email within organization', async () => {
      await repoContact.create({
        id: 'ct_test2',
        organizationId: orgId,
        companyId,
        email: 'unique@test.com',
        firstName: 'Jane',
        lastName: 'Doe',
      })
      const found = await repoContact.findByEmail('unique@test.com', orgId)
      expect(found).toBeDefined()
      expect(found!.email).toBe('unique@test.com')
    })
    it('finds by email and company', async () => {
      await repoContact.create({
        id: 'ct_test3',
        organizationId: orgId,
        companyId,
        email: 'company@test.com',
        firstName: 'Bob',
        lastName: 'Smith',
      })
      const found = await repoContact.findByEmailAndCompany(
        'company@test.com',
        companyId,
        orgId,
      )
      expect(found).toBeDefined()
      expect(found!.company_id).toBe(companyId)
    })
    it('enforces tenant isolation', async () => {
      const otherOrg = await createTestOrganization({ name: 'Other Org' })
      await repoContact.create({
        id: 'ct_test4',
        organizationId: orgId,
        companyId,
        email: 'tenant@test.com',
        firstName: 'Test',
        lastName: 'User',
      })
      const found = await repoContact.findByEmail(
        'tenant@test.com',
        otherOrg.id,
      )
      expect(found).toBeUndefined()
    })
  })

  describe('PostgresLeadRepository', () => {
    it('creates lead with default NEW status', async () => {
      const created = await repoLead.create({
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
      const created = await repoLead.create({
        id: 'ld_test2',
        organizationId: orgId,
        email: 'lock@test.com',
        firstName: 'Lock',
        lastName: 'Test',
      })
      const updated = await repoLead.updateStatus(
        created.id,
        orgId,
        'CONTACTED',
        1,
      )
      expect(updated).toBeDefined()
      expect(updated!.status).toBe('CONTACTED')
      expect(updated!.version).toBe(2)
    })
    it('throws OptimisticLockError on version mismatch', async () => {
      const created = await repoLead.create({
        id: 'ld_test3',
        organizationId: orgId,
        email: 'optimistic@test.com',
        firstName: 'Optimistic',
        lastName: 'Lock',
      })
      await repoLead.updateStatus(created.id, orgId, 'CONTACTED', 1)
      const stale = await repoLead.updateStatus(
        created.id,
        orgId,
        'QUALIFIED',
        1,
      )
      expect(stale).toBeUndefined()
    })
  })

  describe('PostgresDealRepository', () => {
    let companyId: string
    let contactId: string
    beforeEach(async () => {
      const company = await createTestCompany(orgId)
      const contact = await createTestContact(orgId, company.id)
      companyId = company.id
      contactId = contact.id
    })
    it('creates deal with default NEW stage', async () => {
      const created = await repoDeal.create({
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
      const created = await repoDeal.create({
        id: 'dl_test2',
        organizationId: orgId,
        title: 'Lock Deal',
        companyId,
        contactId,
      })
      const updated = await repoDeal.updateStage(
        created.id,
        orgId,
        'QUALIFIED',
        1,
      )
      expect(updated).toBeDefined()
      expect(updated!.stage).toBe('QUALIFIED')
      expect(updated!.version).toBe(2)
    })
    it('throws OptimisticLockError on version mismatch', async () => {
      const created = await repoDeal.create({
        id: 'dl_test3',
        organizationId: orgId,
        title: 'Optimistic Deal',
        companyId,
        contactId,
      })
      await repoDeal.updateStage(created.id, orgId, 'QUALIFIED', 1)
      const stale = await repoDeal.updateStage(created.id, orgId, 'PROPOSAL', 1)
      expect(stale).toBeUndefined()
    })
  })

  describe('Database Constraints', () => {
    it('organizations: unique slug constraint', async () => {
      const db = getTestDb()
      await createTestOrganization({ slug: 'unique-slug' })
      await expect(
        db
          .insertInto('organizations')
          .values({
            id: 'org_dup',
            name: 'Duplicate',
            slug: 'unique-slug',
            created_at: new Date(),
            updated_at: new Date(),
          })
          .execute(),
      ).rejects.toThrow()
    })

    it('users: unique email constraint', async () => {
      const db = getTestDb()
      await createTestUser({ email: 'unique@test.com' })
      await expect(
        db
          .insertInto('users')
          .values({
            id: 'user_dup',
            email: 'unique@test.com',
            name: 'Duplicate',
            password_hash: 'hash',
            created_at: new Date(),
            updated_at: new Date(),
          })
          .execute(),
      ).rejects.toThrow()
    })

    it('companies: soft delete excludes from queries', async () => {
      const db = getTestDb()
      const org = await createTestOrganization()
      const { id } = await db
        .insertInto('companies')
        .values({
          id: 'co_soft',
          organization_id: org.id,
          name: 'Soft Delete Test',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
      const active = await db
        .selectFrom('companies')
        .selectAll()
        .where('organization_id', '=', org.id)
        .where('deleted_at', 'is', null)
        .execute()
      expect(active).toHaveLength(1)
      await db
        .updateTable('companies')
        .set({ deleted_at: new Date() })
        .where('id', '=', id)
        .execute()
      const afterDelete = await db
        .selectFrom('companies')
        .selectAll()
        .where('organization_id', '=', org.id)
        .where('deleted_at', 'is', null)
        .execute()
      expect(afterDelete).toHaveLength(0)
    })
  })
})
