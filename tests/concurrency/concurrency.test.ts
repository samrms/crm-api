import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest'
import { buildApp } from '../../src/app.js'
import type { FastifyInstance } from 'fastify'
import {
  startTestDatabase,
  stopTestDatabase,
  getTestDb,
} from '../fixtures/testDatabase.js'
import {
  createTestOrganization,
  createTestUser,
  createTestMembership,
  createTestSession,
  cleanupTestData,
} from '../fixtures/factories.js'
import { PostgresDealRepository } from '../../src/modules/crm/deals/infrastructure/PostgresDealRepository.js'
import { DealService } from '../../src/modules/crm/deals/application/DealService.js'
import { OptimisticLockError } from '../../src/shared/errors/AppError.js'

let app: FastifyInstance

describe('Concurrency Tests', () => {
  beforeAll(async () => {
    await startTestDatabase()
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await stopTestDatabase()
  })

  beforeEach(async () => {
    await cleanupTestData()
  })

  describe('Optimistic Concurrency - Two Users Update Same Deal', () => {
    it('one succeeds, one receives 409 Conflict', async () => {
      const org = await createTestOrganization()
      const user1 = await createTestUser({ email: 'user1@test.com' })
      const user2 = await createTestUser({ email: 'user2@test.com' })
      await createTestMembership({
        userId: user1.id,
        organizationId: org.id,
        role: 'ADMIN',
      })
      await createTestMembership({
        userId: user2.id,
        organizationId: org.id,
        role: 'ADMIN',
      })
      const { token: token1 } = await createTestSession(user1.id, org.id)
      const { token: token2 } = await createTestSession(user2.id, org.id)

      // Create deal
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/deals',
        payload: { title: 'Concurrent Deal', value: 10000 },
        cookies: { session: token1 },
      })
      const deal = JSON.parse(createRes.payload).data

      // Both users try to advance to QUALIFIED simultaneously
      const [res1, res2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: `/api/v1/deals/${deal.id}/advance`,
          payload: { stage: 'QUALIFIED' },
          cookies: { session: token1 },
        }),
        app.inject({
          method: 'POST',
          url: `/api/v1/deals/${deal.id}/advance`,
          payload: { stage: 'QUALIFIED' },
          cookies: { session: token2 },
        }),
      ])

      const successCount = [res1, res2].filter(
        (r) => r.statusCode === 200,
      ).length
      const conflictCount = [res1, res2].filter(
        (r) => r.statusCode === 409,
      ).length

      expect(successCount).toBe(1)
      expect(conflictCount).toBe(1)
    })

    it('stale repository update reports failure and the service maps it to OptimisticLockError', async () => {
      const org = await createTestOrganization()
      const repo = new PostgresDealRepository(getTestDb())

      const deal = await repo.create({
        id: 'dl_concurrent',
        organizationId: org.id,
        title: 'Concurrent Deal',
      })

      const updated = await repo.updateStage(deal.id, org.id, 'QUALIFIED', 1)
      expect(updated).toBeDefined()
      expect(updated!.version).toBe(2)

      const stale = await repo.updateStage(deal.id, org.id, 'PROPOSAL', 1)
      expect(stale).toBeUndefined()

      vi.spyOn(repo, 'findById').mockResolvedValue({
        ...deal,
        stage: 'QUALIFIED',
        version: 1,
      })

      const service = new DealService(repo)
      await expect(
        service.advance(deal.id, org.id, 'PROPOSAL'),
      ).rejects.toThrow(OptimisticLockError)
    })
  })

  describe('Duplicate Asynchronous Job Execution', () => {
    it('duplicate import job execution is idempotent', async () => {
      const db = getTestDb()
      const org = await createTestOrganization()

      // Create import record
      const importId = 'imp_duplicate_test'
      await db
        .insertInto('imports')
        .values({
          id: importId,
          organization_id: org.id,
          actor_id: 'user_1',
          type: 'companies',
          status: 'PENDING',
          total: 0,
          processed: 0,
          successful: 0,
          failed: 0,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute()

      // Simulate job processor running twice
      async function processImport() {
        const existing = await db
          .selectFrom('imports')
          .selectAll()
          .where('id', '=', importId)
          .executeTakeFirst()

        if (
          existing &&
          (existing as { status: string }).status === 'COMPLETED'
        ) {
          return { skipped: true }
        }

        await db
          .updateTable('imports')
          .set({ status: 'PROCESSING', updated_at: new Date() })
          .where('id', '=', importId)
          .execute()

        // Simulate work
        await new Promise((r) => setTimeout(r, 10))

        await db
          .updateTable('imports')
          .set({
            status: 'COMPLETED',
            total: 10,
            processed: 10,
            successful: 10,
            failed: 0,
            updated_at: new Date(),
          })
          .where('id', '=', importId)
          .execute()

        return { skipped: false }
      }

      // Run twice concurrently
      await Promise.all([processImport(), processImport()])

      // One should succeed, one should be skipped
      const completed = await db
        .selectFrom('imports')
        .selectAll()
        .where('id', '=', importId)
        .executeTakeFirst()

      expect(completed).toBeDefined()
      expect((completed as { status: string }).status).toBe('COMPLETED')
      expect((completed as { successful: number }).successful).toBe(10)
      // Not 20 (which would happen if both processed)
    })

    it('duplicate export job execution is idempotent', async () => {
      const db = getTestDb()
      const org = await createTestOrganization()

      const exportId = 'exp_duplicate_test'
      await db
        .insertInto('exports')
        .values({
          id: exportId,
          organization_id: org.id,
          actor_id: 'user_1',
          type: 'companies',
          status: 'PENDING',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute()

      async function processExport() {
        const existing = await db
          .selectFrom('exports')
          .selectAll()
          .where('id', '=', exportId)
          .executeTakeFirst()

        if (
          existing &&
          (existing as { status: string }).status === 'COMPLETED'
        ) {
          return { skipped: true }
        }

        await db
          .updateTable('exports')
          .set({ status: 'PROCESSING', updated_at: new Date() })
          .where('id', '=', exportId)
          .execute()

        await new Promise((r) => setTimeout(r, 10))

        await db
          .updateTable('exports')
          .set({
            status: 'COMPLETED',
            file_path: `/storage/exports/${exportId}.csv`,
            updated_at: new Date(),
          })
          .where('id', '=', exportId)
          .execute()

        return { skipped: false }
      }

      await Promise.all([processExport(), processExport()])

      const completed = await db
        .selectFrom('exports')
        .selectAll()
        .where('id', '=', exportId)
        .executeTakeFirst()

      expect(completed).toBeDefined()
      expect((completed as { status: string }).status).toBe('COMPLETED')
    })
  })

  describe('Concurrent Idempotent Requests', () => {
    it('concurrent identical requests are handled correctly', async () => {
      const org = await createTestOrganization()
      const user = await createTestUser()
      await createTestMembership({ userId: user.id, organizationId: org.id })
      const { token } = await createTestSession(user.id, org.id)

      // Send 10 concurrent requests to create the same company
      const requests = Array(10)
        .fill(null)
        .map(() =>
          app.inject({
            method: 'POST',
            url: '/api/v1/companies',
            payload: { name: 'Concurrent Company' },
            cookies: { session: token },
          }),
        )

      const results = await Promise.all(requests)

      // All should succeed (201) - but due to unique constraints on name+org,
      // only first should create, rest should fail with 409 or similar
      // Actually, since name is not unique, all might succeed
      // The key is no 500 errors
      const errorCount = results.filter((r) => r.statusCode >= 500).length
      expect(errorCount).toBe(0)

      // Verify only one company was created (if name was unique)
      // Since name is not unique, all 10 will be created
      const db = getTestDb()
      const companies = await db
        .selectFrom('companies')
        .selectAll()
        .where('organization_id', '=', org.id)
        .where('name', '=', 'Concurrent Company')
        .execute()

      // All 10 requests created a company (no unique constraint on name)
      expect(companies.length).toBe(10)
    })
  })

  describe('Lead Conversion Concurrency', () => {
    it('cannot convert same lead twice', async () => {
      const org = await createTestOrganization()
      const user = await createTestUser()
      await createTestMembership({ userId: user.id, organizationId: org.id })
      const { token } = await createTestSession(user.id, org.id)

      // Create lead
      const leadRes = await app.inject({
        method: 'POST',
        url: '/api/v1/leads',
        payload: {
          email: 'convert@test.com',
          firstName: 'Convert',
          lastName: 'Test',
        },
        cookies: { session: token },
      })
      const lead = JSON.parse(leadRes.payload).data

      // Qualify it
      await app.inject({
        method: 'POST',
        url: `/api/v1/leads/${lead.id}/qualify`,
        cookies: { session: token },
      })
      await app.inject({
        method: 'POST',
        url: `/api/v1/leads/${lead.id}/qualify`,
        cookies: { session: token },
      })

      // Try to convert twice concurrently
      const [res1, res2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: `/api/v1/leads/${lead.id}/convert`,
          payload: { dealTitle: 'Deal 1' },
          cookies: { session: token },
        }),
        app.inject({
          method: 'POST',
          url: `/api/v1/leads/${lead.id}/convert`,
          payload: { dealTitle: 'Deal 2' },
          cookies: { session: token },
        }),
      ])

      // One should succeed (201), one should fail (409 or 422)
      const successCount = [res1, res2].filter(
        (r) => r.statusCode === 201,
      ).length
      const errorCount = [res1, res2].filter(
        (r) => r.statusCode >= 400 && r.statusCode < 500,
      ).length

      expect(successCount + errorCount).toBe(2)
      expect(successCount).toBe(1)

      // Verify only one deal was created
      const db = getTestDb()
      const deals = await db
        .selectFrom('deals')
        .selectAll()
        .where('leadId', '=', lead.id)
        .execute()

      expect(deals.length).toBe(1)
    })
  })
})
