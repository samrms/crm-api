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
import { PostgresDealRepository } from '../../src/modules/deals/infrastructure/PostgresDealRepository.js'
import { PostgresLeadRepository } from '../../src/modules/leads/infrastructure/PostgresLeadRepository.js'
import { OptimisticLockError } from '../../src/shared/errors/AppError.js'

describe('Integration: Optimistic Concurrency', () => {
  beforeAll(async () => {
    await startTestDatabase()
  })

  afterAll(async () => {
    await stopTestDatabase()
  })

  beforeEach(async () => {
    await cleanupTestData()
  })

  it('deal: two concurrent updates - second fails with 409', async () => {
    const org = await createTestOrganization()
    const repo = new PostgresDealRepository()

    const deal = await repo.create({
      id: 'dl_concurrent',
      organizationId: org.id,
      title: 'Concurrent Deal',
    })

    // First update succeeds
    const updated1 = await repo.updateStage(deal.id, org.id, 'QUALIFIED', 1)
    expect(updated1).toBeDefined()
    expect(updated1!.version).toBe(2)

    // Second update with stale version fails
    await expect(
      repo.updateStage(deal.id, org.id, 'PROPOSAL', 1),
    ).rejects.toThrow(OptimisticLockError)
  })

  it('lead: two concurrent updates - second fails with 409', async () => {
    const org = await createTestOrganization()
    const repo = new PostgresLeadRepository()

    const lead = await repo.create({
      id: 'ld_concurrent',
      organizationId: org.id,
      email: 'concurrent@test.com',
      firstName: 'Concurrent',
      lastName: 'Lead',
    })

    const updated1 = await repo.updateStatus(lead.id, org.id, 'CONTACTED', 1)
    expect(updated1).toBeDefined()
    expect(updated1!.version).toBe(2)

    await expect(
      repo.updateStatus(lead.id, org.id, 'QUALIFIED', 1),
    ).rejects.toThrow(OptimisticLockError)
  })

  it('deal: successful update increments version', async () => {
    const org = await createTestOrganization()
    const repo = new PostgresDealRepository()

    const deal = await repo.create({
      id: 'dl_version',
      organizationId: org.id,
      title: 'Version Test',
    })

    expect(deal.version).toBe(1)

    const v1 = await repo.updateStage(deal.id, org.id, 'QUALIFIED', 1)
    expect(v1!.version).toBe(2)

    const v2 = await repo.updateStage(deal.id, org.id, 'PROPOSAL', 2)
    expect(v2!.version).toBe(3)

    const v3 = await repo.updateStage(deal.id, org.id, 'NEGOTIATION', 3)
    expect(v3!.version).toBe(4)
  })
})

describe('Integration: Database Constraints', () => {
  beforeAll(async () => {
    await startTestDatabase()
  })

  afterAll(async () => {
    await stopTestDatabase()
  })

  beforeEach(async () => {
    await cleanupTestData()
  })

  it('organizations: unique slug constraint', async () => {
    const db = getTestDb()
    const org1 = await createTestOrganization({ slug: 'unique-slug' })

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
    const user1 = await createTestUser({ email: 'unique@test.com' })

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

  it('sessions: unique token constraint', async () => {
    const db = getTestDb()
    const org = await createTestOrganization()
    const user = await createTestUser()

    await db
      .insertInto('sessions')
      .values({
        id: 'sess_1',
        token: 'unique-token',
        user_id: user.id,
        organization_id: org.id,
        expires_at: new Date(Date.now() + 86400000),
        created_at: new Date(),
      })
      .execute()

    await expect(
      db
        .insertInto('sessions')
        .values({
          id: 'sess_2',
          token: 'unique-token',
          user_id: user.id,
          organization_id: org.id,
          expires_at: new Date(Date.now() + 86400000),
          created_at: new Date(),
        })
        .execute(),
    ).rejects.toThrow()
  })

  it('deals: foreign key to organizations', async () => {
    const db = getTestDb()
    const org = await createTestOrganization()

    await expect(
      db
        .insertInto('deals')
        .values({
          id: 'dl_fk',
          organization_id: 'org_nonexistent',
          title: 'FK Test',
          stage: 'NEW',
          version: 1,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute(),
    ).rejects.toThrow()
  })

  it('contacts: foreign key to companies', async () => {
    const db = getTestDb()
    const org = await createTestOrganization()

    await expect(
      db
        .insertInto('contacts')
        .values({
          id: 'ct_fk',
          organization_id: org.id,
          company_id: 'co_nonexistent',
          email: 'fk@test.com',
          firstName: 'FK',
          lastName: 'Test',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute(),
    ).rejects.toThrow()
  })

  it('memberships: cascading delete on user', async () => {
    const db = getTestDb()
    const org = await createTestOrganization()
    const user = await createTestUser()

    await db
      .insertInto('memberships')
      .values({
        id: 'mem_cascade',
        user_id: user.id,
        organization_id: org.id,
        role: 'OWNER',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()

    await db.deleteFrom('users').where('id', '=', user.id).execute()

    const memberships = await db
      .selectFrom('memberships')
      .where('user_id', '=', user.id)
      .execute()

    expect(memberships).toHaveLength(0)
  })

  it('companies: soft delete excludes from queries', async () => {
    const db = getTestDb()
    const org = await createTestOrganization()

    const company = await db
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

    // Active query
    const active = await db
      .selectFrom('companies')
      .where('organization_id', '=', org.id)
      .where('deleted_at', 'is', null)
      .execute()

    expect(active).toHaveLength(1)

    // Soft delete
    await db
      .updateTable('companies')
      .set({ deleted_at: new Date() })
      .where('id', '=', company.id)
      .execute()

    // Should be excluded
    const afterDelete = await db
      .selectFrom('companies')
      .where('organization_id', '=', org.id)
      .where('deleted_at', 'is', null)
      .execute()

    expect(afterDelete).toHaveLength(0)
  })
})
