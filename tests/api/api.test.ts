import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildApp } from '../../src/app.js'
import type { FastifyInstance } from 'fastify'
import {
  startTestDatabase,
  stopTestDatabase,
} from '../fixtures/testDatabase.js'
import {
  createTestOrganization,
  createTestUser,
  createTestMembership,
  createTestSession,
  cleanupTestData,
} from '../fixtures/factories.js'

let app: FastifyInstance

describe('API Tests', () => {
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

  describe('Health', () => {
    it('GET /health returns ok', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.payload)).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
      })
    })

    it('GET /ready returns ready', async () => {
      const res = await app.inject({ method: 'GET', url: '/ready' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.status).toBe('ready')
      expect(body.checks.postgres).toBe('ok')
      expect(body.checks.redis).toBe('ok')
    })
  })

  describe('Auth: Register', () => {
    it('POST /api/v1/auth/register creates org, user, membership, session', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'newuser@test.com',
          password: 'password123',
          name: 'New User',
          organizationName: 'New Org',
        },
      })

      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.payload)
      expect(body.data.user.email).toBe('newuser@test.com')
      expect(body.data.user.name).toBe('New User')
      expect(body.data.organization.name).toBe('New Org')

      // Cookie should be set
      const setCookie = res.headers['set-cookie']
      const cookieHeader = Array.isArray(setCookie)
        ? setCookie.join('; ')
        : setCookie
      expect(cookieHeader).toBeDefined()
      expect(cookieHeader).toContain('session=')
    })

    it('rejects duplicate email', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'duplicate@test.com',
          password: 'password123',
          name: 'User 1',
          organizationName: 'Org 1',
        },
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'duplicate@test.com',
          password: 'password123',
          name: 'User 2',
          organizationName: 'Org 2',
        },
      })

      expect(res.statusCode).toBe(409)
      const body = JSON.parse(res.payload)
      expect(body.error.code).toBe('CONFLICT')
    })

    it('validates required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: 'invalid' },
      })

      expect(res.statusCode).toBe(422)
      const body = JSON.parse(res.payload)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('Auth: Login', () => {
    it('POST /api/v1/auth/login returns session cookie', async () => {
      const org = await createTestOrganization()
      const user = await createTestUser({
        email: 'login@test.com',
        password: 'password123',
      })
      await createTestMembership({
        userId: user.id,
        organizationId: org.id,
        role: 'OWNER',
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'login@test.com', password: 'password123' },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.data.user.email).toBe('login@test.com')

      const cookie = res.headers['set-cookie']
      expect(cookie).toBeDefined()
    })

    it('rejects wrong password', async () => {
      const org = await createTestOrganization()
      const user = await createTestUser({
        email: 'wrongpass@test.com',
        password: 'password123',
      })
      await createTestMembership({ userId: user.id, organizationId: org.id })

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'wrongpass@test.com', password: 'wrong' },
      })

      expect(res.statusCode).toBe(401)
      const body = JSON.parse(res.payload)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('rejects non-existent email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'nonexistent@test.com', password: 'password123' },
      })

      expect(res.statusCode).toBe(401)
    })
  })

  describe('Auth: Me', () => {
    it('GET /api/v1/auth/me returns user and org with valid session', async () => {
      const org = await createTestOrganization()
      const user = await createTestUser()
      await createTestMembership({
        userId: user.id,
        organizationId: org.id,
        role: 'OWNER',
      })
      const { token } = await createTestSession(user.id, org.id)

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        cookies: { session: token },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.data.user.id).toBe(user.id)
      expect(body.data.organization.id).toBe(org.id)
      expect(body.data.role).toBe('OWNER')
    })

    it('rejects request without session', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      })

      expect(res.statusCode).toBe(401)
      const body = JSON.parse(res.payload)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('Auth: Logout', () => {
    it('POST /api/v1/auth/logout revokes session', async () => {
      const org = await createTestOrganization()
      const user = await createTestUser()
      await createTestMembership({ userId: user.id, organizationId: org.id })
      const { token } = await createTestSession(user.id, org.id)

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        cookies: { session: token },
      })

      expect(res.statusCode).toBe(204)

      // Session should be revoked
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        cookies: { session: token },
      })
      expect(meRes.statusCode).toBe(401)
    })
  })

  describe('Companies', () => {
    let authCookie: string

    beforeEach(async () => {
      const org = await createTestOrganization()
      const user = await createTestUser()
      await createTestMembership({ userId: user.id, organizationId: org.id })
      const { token } = await createTestSession(user.id, org.id)
      authCookie = token
    })

    it('POST /api/v1/companies creates company', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/companies',
        payload: { name: 'New Company', domain: 'new.com' },
        cookies: { session: authCookie },
      })

      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.payload)
      expect(body.data.name).toBe('New Company')
      expect(body.data.domain).toBe('new.com')
      expect(body.data._links.self).toBeDefined()
    })

    it('GET /api/v1/companies lists companies', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/companies',
        payload: { name: 'List Company' },
        cookies: { session: authCookie },
      })

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/companies',
        cookies: { session: authCookie },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.data).toHaveLength(1)
      expect(body.pagination).toBeDefined()
    })

    it('GET /api/v1/companies/:id returns company with HATEOAS', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/companies',
        payload: { name: 'Detail Company' },
        cookies: { session: authCookie },
      })
      const company = JSON.parse(createRes.payload).data

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/companies/${company.id}`,
        cookies: { session: authCookie },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.data._links.self).toBeDefined()
      expect(body.data._links.contacts).toBeDefined()
    })

    it('PATCH /api/v1/companies/:id updates company', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/companies',
        payload: { name: 'Original' },
        cookies: { session: authCookie },
      })
      const company = JSON.parse(createRes.payload).data

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/companies/${company.id}`,
        payload: { name: 'Updated' },
        cookies: { session: authCookie },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.data.name).toBe('Updated')
    })

    it('returns 404 for non-existent company', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/companies/co_nonexistent',
        cookies: { session: authCookie },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('Leads', () => {
    let authCookie: string

    beforeEach(async () => {
      const org = await createTestOrganization()
      const user = await createTestUser()
      await createTestMembership({ userId: user.id, organizationId: org.id })
      const { token } = await createTestSession(user.id, org.id)
      authCookie = token
    })

    it('POST /api/v1/leads creates lead with NEW status', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/leads',
        payload: {
          email: 'lead@test.com',
          firstName: 'John',
          lastName: 'Doe',
          company: 'Acme Corp',
        },
        cookies: { session: authCookie },
      })

      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.payload)
      expect(body.data.status).toBe('NEW')
      expect(body.data._links.qualify).toBeDefined()
    })

    it('POST /api/v1/leads/:id/qualify transitions NEW -> CONTACTED -> QUALIFIED', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/leads',
        payload: {
          email: 'qualify@test.com',
          firstName: 'Qualify',
          lastName: 'Test',
        },
        cookies: { session: authCookie },
      })
      const lead = JSON.parse(createRes.payload).data

      // First: NEW -> CONTACTED
      const contactRes = await app.inject({
        method: 'POST',
        url: `/api/v1/leads/${lead.id}/qualify`,
        cookies: { session: authCookie },
      })
      expect(contactRes.statusCode).toBe(200)
      expect(JSON.parse(contactRes.payload).data.status).toBe('QUALIFIED')

      // Second: CONTACTED -> QUALIFIED (should work)
      const qualifyRes = await app.inject({
        method: 'POST',
        url: `/api/v1/leads/${lead.id}/qualify`,
        cookies: { session: authCookie },
      })
      expect(qualifyRes.statusCode).toBe(200)
      expect(JSON.parse(qualifyRes.payload).data.status).toBe('QUALIFIED')
    })

    it('rejects invalid state transition', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/leads',
        payload: {
          email: 'invalid@test.com',
          firstName: 'Invalid',
          lastName: 'Transition',
        },
        cookies: { session: authCookie },
      })
      const lead = JSON.parse(createRes.payload).data

      // Try to convert directly from NEW (should fail)
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/leads/${lead.id}/convert`,
        payload: { dealTitle: 'Deal' },
        cookies: { session: authCookie },
      })

      expect(res.statusCode).toBe(422)
      const body = JSON.parse(res.payload)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('Deals', () => {
    let authCookie: string

    beforeEach(async () => {
      const org = await createTestOrganization()
      const user = await createTestUser()
      await createTestMembership({ userId: user.id, organizationId: org.id })
      const { token } = await createTestSession(user.id, org.id)
      authCookie = token
    })

    it('POST /api/v1/deals creates deal with NEW stage', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/deals',
        payload: { title: 'New Deal', value: 10000 },
        cookies: { session: authCookie },
      })

      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.payload)
      expect(body.data.stage).toBe('NEW')
      expect(body.data._links.win).toBeDefined()
      expect(body.data._links.lose).toBeDefined()
    })

    it('POST /api/v1/deals/:id/win transitions NEGOTIATION -> WON', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/deals',
        payload: { title: 'Win Deal' },
        cookies: { session: authCookie },
      })
      const deal = JSON.parse(createRes.payload).data

      // Advance to NEGOTIATION
      await app.inject({
        method: 'POST',
        url: `/api/v1/deals/${deal.id}/advance`,
        payload: { stage: 'QUALIFIED' },
        cookies: { session: authCookie },
      })
      await app.inject({
        method: 'POST',
        url: `/api/v1/deals/${deal.id}/advance`,
        payload: { stage: 'PROPOSAL' },
        cookies: { session: authCookie },
      })
      await app.inject({
        method: 'POST',
        url: `/api/v1/deals/${deal.id}/advance`,
        payload: { stage: 'NEGOTIATION' },
        cookies: { session: authCookie },
      })

      // Win
      const winRes = await app.inject({
        method: 'POST',
        url: `/api/v1/deals/${deal.id}/win`,
        cookies: { session: authCookie },
      })

      expect(winRes.statusCode).toBe(200)
      expect(JSON.parse(winRes.payload).data.stage).toBe('WON')
    })

    it('POST /api/v1/deals/:id/lose transitions NEGOTIATION -> LOST', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/deals',
        payload: { title: 'Lose Deal' },
        cookies: { session: authCookie },
      })
      const deal = JSON.parse(createRes.payload).data

      await app.inject({
        method: 'POST',
        url: `/api/v1/deals/${deal.id}/advance`,
        payload: { stage: 'QUALIFIED' },
        cookies: { session: authCookie },
      })
      await app.inject({
        method: 'POST',
        url: `/api/v1/deals/${deal.id}/advance`,
        payload: { stage: 'PROPOSAL' },
        cookies: { session: authCookie },
      })
      await app.inject({
        method: 'POST',
        url: `/api/v1/deals/${deal.id}/advance`,
        payload: { stage: 'NEGOTIATION' },
        cookies: { session: authCookie },
      })

      const loseRes = await app.inject({
        method: 'POST',
        url: `/api/v1/deals/${deal.id}/lose`,
        cookies: { session: authCookie },
      })

      expect(loseRes.statusCode).toBe(200)
      expect(JSON.parse(loseRes.payload).data.stage).toBe('LOST')
    })

    it('rejects invalid stage transition', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/deals',
        payload: { title: 'Invalid Transition' },
        cookies: { session: authCookie },
      })
      const deal = JSON.parse(createRes.payload).data

      // Try to win from NEW
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/deals/${deal.id}/win`,
        cookies: { session: authCookie },
      })

      expect(res.statusCode).toBe(422)
      const body = JSON.parse(res.payload)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('HATEOAS links are state-aware', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/deals',
        payload: { title: 'HATEOAS Test' },
        cookies: { session: authCookie },
      })
      const deal = JSON.parse(createRes.payload).data

      expect(deal._links.win).toBeDefined()
      expect(deal._links.lose).toBeDefined()

      // Advance to NEGOTIATION
      await app.inject({
        method: 'POST',
        url: `/api/v1/deals/${deal.id}/advance`,
        payload: { stage: 'QUALIFIED' },
        cookies: { session: authCookie },
      })
      await app.inject({
        method: 'POST',
        url: `/api/v1/deals/${deal.id}/advance`,
        payload: { stage: 'PROPOSAL' },
        cookies: { session: authCookie },
      })
      await app.inject({
        method: 'POST',
        url: `/api/v1/deals/${deal.id}/advance`,
        payload: { stage: 'NEGOTIATION' },
        cookies: { session: authCookie },
      })

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/deals/${deal.id}`,
        cookies: { session: authCookie },
      })
      const negotiated = JSON.parse(res.payload).data

      // NEGOTIATION: win/lose should be available
      expect(negotiated._links.win).toBeDefined()
      expect(negotiated._links.lose).toBeDefined()
    })
  })

  describe('Pagination', () => {
    let authCookie: string

    beforeEach(async () => {
      const org = await createTestOrganization()
      const user = await createTestUser()
      await createTestMembership({ userId: user.id, organizationId: org.id })
      const { token } = await createTestSession(user.id, org.id)
      authCookie = token

      // Create 30 companies
      for (let i = 0; i < 30; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/v1/companies',
          payload: { name: `Company ${i}` },
          cookies: { session: authCookie },
        })
      }
    })

    it('returns default limit of 25', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/companies',
        cookies: { session: authCookie },
      })

      const body = JSON.parse(res.payload)
      expect(body.data.length).toBe(25)
      expect(body.pagination.hasNextPage).toBe(true)
      expect(body.pagination.nextCursor).toBeDefined()
    })

    it('respects limit parameter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/companies?limit=10',
        cookies: { session: authCookie },
      })

      const body = JSON.parse(res.payload)
      expect(body.data.length).toBe(10)
      expect(body.pagination.limit).toBe(10)
    })

    it('uses cursor for next page', async () => {
      const first = await app.inject({
        method: 'GET',
        url: '/api/v1/companies?limit=10',
        cookies: { session: authCookie },
      })
      const firstBody = JSON.parse(first.payload)
      expect(firstBody.pagination.nextCursor).toBeDefined()

      const second = await app.inject({
        method: 'GET',
        url: `/api/v1/companies?limit=10&after=${firstBody.pagination.nextCursor}`,
        cookies: { session: authCookie },
      })
      const secondBody = JSON.parse(second.payload)
      expect(secondBody.data.length).toBe(10)
      // Second page should have different companies
      expect(secondBody.data[0].id).not.toBe(firstBody.data[0].id)
    })

    it('rejects tampered cursor', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/companies?after=invalid.tampered',
        cookies: { session: authCookie },
      })

      expect(res.statusCode).toBe(400)
    })
  })

  describe('Tenant Isolation', () => {
    it('organization A cannot access organization B resources', async () => {
      const orgA = await createTestOrganization()
      const userA = await createTestUser()
      await createTestMembership({ userId: userA.id, organizationId: orgA.id })
      const { token: tokenA } = await createTestSession(userA.id, orgA.id)

      const orgB = await createTestOrganization()
      const userB = await createTestUser()
      await createTestMembership({ userId: userB.id, organizationId: orgB.id })
      const { token: tokenB } = await createTestSession(userB.id, orgB.id)

      // User A creates company
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/companies',
        payload: { name: 'Org A Company' },
        cookies: { session: tokenA },
      })
      const companyA = JSON.parse(createRes.payload).data

      // User B tries to access User A's company
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/companies/${companyA.id}`,
        cookies: { session: tokenB },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('Rate Limiting', () => {
    it('enforces rate limit', async () => {
      const limitedApp = await buildApp({
        rateLimit: { max: 3, timeWindow: '1 minute' },
      })
      await limitedApp.ready()

      try {
        const statuses: number[] = []
        let lastBody = ''
        for (let i = 0; i < 4; i++) {
          const res = await limitedApp.inject({
            method: 'GET',
            url: '/health',
          })
          statuses.push(res.statusCode)
          lastBody = res.payload
        }

        expect(statuses).toEqual([200, 200, 200, 429])
        expect(JSON.parse(lastBody).error.code).toBe('RATE_LIMITED')
      } finally {
        await limitedApp.close()
      }
    })
  })
  describe('Error Contract', () => {
    let authCookie: string

    beforeEach(async () => {
      const org = await createTestOrganization()
      const user = await createTestUser()
      await createTestMembership({ userId: user.id, organizationId: org.id })
      const { token } = await createTestSession(user.id, org.id)
      authCookie = token
    })

    it('404 errors have correct contract', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/companies/co_nonexistent',
        cookies: { session: authCookie },
      })

      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.payload)
      expect(body.error.code).toBe('NOT_FOUND')
      expect(body.error.message).toContain('Company')
      expect(body.error.requestId).toBeDefined()
    })

    it('422 errors have correct contract', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/companies',
        payload: { name: '' }, // invalid
        cookies: { session: authCookie },
      })

      expect(res.statusCode).toBe(422)
      const body = JSON.parse(res.payload)
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.details).toBeDefined()
    })
  })

  describe('Docs', () => {
    it('GET /docs/ serves the Swagger UI', async () => {
      const res = await app.inject({ method: 'GET', url: '/docs/' })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toContain('text/html')
    })

    it('GET /docs/json serves the OpenAPI document', async () => {
      const res = await app.inject({ method: 'GET', url: '/docs/json' })
      expect(res.statusCode).toBe(200)
      const spec = JSON.parse(res.payload)
      expect(spec.openapi).toMatch(/^3\./)
      expect(spec.paths['/api/v1/companies'].post.requestBody).toBeDefined()
      expect(spec.paths['/api/v1/auth/login'].post.requestBody).toBeDefined()
      expect(
        spec.paths['/api/v1/leads/{id}/convert'].post.requestBody,
      ).toBeDefined()
    })
  })

  describe('Audit', () => {
    it('GET /api/v1/audit-events requires authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit-events',
      })

      expect(res.statusCode).toBe(401)
    })

    it('GET /api/v1/audit-events forbids MEMBER role', async () => {
      const org = await createTestOrganization()
      const user = await createTestUser()
      await createTestMembership({
        userId: user.id,
        organizationId: org.id,
        role: 'MEMBER',
      })
      const { token } = await createTestSession(user.id, org.id)

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit-events',
        cookies: { session: token },
      })

      expect(res.statusCode).toBe(403)
    })

    it('GET /api/v1/audit-events allows OWNER role', async () => {
      const org = await createTestOrganization()
      const user = await createTestUser()
      await createTestMembership({
        userId: user.id,
        organizationId: org.id,
        role: 'OWNER',
      })
      const { token } = await createTestSession(user.id, org.id)

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit-events',
        cookies: { session: token },
      })

      expect(res.statusCode).toBe(200)
    })
  })
})
