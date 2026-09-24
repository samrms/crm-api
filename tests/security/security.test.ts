import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp } from '../fixtures/app.js'
import { getTestDb, stopTestDatabase } from '../fixtures/testDatabase.js'
import {
  cleanupTestData,
  createTestCompany,
  createTestContact,
  createTestDeal,
  createTestLead,
  createTestMembership,
  createTestOrganization,
  createTestSession,
  createTestUser,
} from '../fixtures/factories.js'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildTestApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
  await stopTestDatabase()
})

beforeEach(cleanupTestData)

async function createTenant() {
  const org = await createTestOrganization()
  const user = await createTestUser()
  await createTestMembership({ userId: user.id, organizationId: org.id })
  const { token } = await createTestSession(user.id, org.id)
  return { org, user, token }
}

describe('IDOR', () => {
  it('does not expose another org companies, contacts, leads or deals', async () => {
    const orgA = await createTenant()
    const orgB = await createTenant()

    const company = await createTestCompany(orgA.org.id, { name: 'Secret Co' })
    const contact = await createTestContact(orgA.org.id, company.id)
    const lead = await createTestLead(orgA.org.id)
    const deal = await createTestDeal(orgA.org.id, { title: 'Secret Deal' })

    const urls = [
      `/api/v1/companies/${company.id}`,
      `/api/v1/contacts/${contact.id}`,
      `/api/v1/leads/${lead.id}`,
      `/api/v1/deals/${deal.id}`,
    ]
    for (const url of urls) {
      const res = await app.inject({
        method: 'GET',
        url,
        cookies: { session: orgB.token },
      })
      expect(res.statusCode).toBe(404)
    }
  })

  it('cannot mutate another org company', async () => {
    const orgA = await createTenant()
    const orgB = await createTenant()
    const company = await createTestCompany(orgA.org.id)

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/companies/${company.id}`,
      cookies: { session: orgB.token },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('tenant escape via listing', () => {
  it('lists zero rows for a tenant without data', async () => {
    const orgA = await createTenant()
    const orgB = await createTenant()
    await createTestCompany(orgA.org.id)

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/companies',
      cookies: { session: orgB.token },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toHaveLength(0)
  })
})

describe('mass assignment', () => {
  it('ignores organization_id, role and deleted_at in the body', async () => {
    const { org, token } = await createTenant()
    const other = await createTestOrganization()

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/companies',
      payload: {
        name: 'Mass Assigned',
        organization_id: other.id,
        organizationId: other.id,
        role: 'OWNER',
        deletedAt: '2020-01-01T00:00:00Z',
      },
      cookies: { session: token },
    })
    expect(res.statusCode).toBe(201)
    const data = res.json().data
    expect(data.organization_id).toBe(org.id)
    expect(data.role).toBeUndefined()
    expect(data.deleted_at).toBeNull()
  })
})

describe('injection attempts', () => {
  it('treats SQL metacharacters in filters as literals', async () => {
    const { token } = await createTenant()
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/companies?name=${encodeURIComponent("' OR '1'='1")}`,
      cookies: { session: token },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toHaveLength(0)
  })

  it('answers 404 (not 500) for injection in the id parameter', async () => {
    const { token } = await createTenant()
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/companies/${encodeURIComponent("co' OR '1'='1")}`,
      cookies: { session: token },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('authentication', () => {
  it('requires a session on all api endpoints', async () => {
    const endpoints: Array<{ method: 'GET' | 'POST'; url: string }> = [
      { method: 'GET', url: '/api/v1/companies' },
      { method: 'POST', url: '/api/v1/companies' },
      { method: 'GET', url: '/api/v1/contacts' },
      { method: 'POST', url: '/api/v1/contacts' },
      { method: 'GET', url: '/api/v1/leads' },
      { method: 'POST', url: '/api/v1/leads' },
      { method: 'GET', url: '/api/v1/deals' },
      { method: 'POST', url: '/api/v1/deals' },
      { method: 'POST', url: '/api/v1/imports' },
      { method: 'POST', url: '/api/v1/exports' },
      { method: 'GET', url: '/api/v1/auth/me' },
    ]
    for (const endpoint of endpoints) {
      const res = await app.inject({
        ...endpoint,
        payload: endpoint.method === 'POST' ? { name: 'x' } : undefined,
      })
      expect(res.statusCode).toBe(401)
      expect(res.json().error.code).toBe('UNAUTHORIZED')
    }
  })

  it('rejects expired sessions', async () => {
    const db = getTestDb()
    const org = await createTestOrganization()
    const user = await createTestUser()
    await createTestMembership({ userId: user.id, organizationId: org.id })
    const token = 'expired-token'
    await db
      .insertInto('sessions')
      .values({
        id: 'sess_expired',
        token,
        user_id: user.id,
        organization_id: org.id,
        expires_at: new Date(Date.now() - 86_400_000),
        created_at: new Date(),
      })
      .execute()

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/companies',
      cookies: { session: token },
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejects sessions revoked by logout', async () => {
    const { token } = await createTenant()
    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      cookies: { session: token },
    })
    expect(logout.statusCode).toBe(204)

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/companies',
      cookies: { session: token },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('authorization', () => {
  it('forbids MEMBER from writing', async () => {
    const org = await createTestOrganization()
    const user = await createTestUser()
    await createTestMembership({
      userId: user.id,
      organizationId: org.id,
      role: 'MEMBER',
    })
    const { token } = await createTestSession(user.id, org.id)

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/companies',
      payload: { name: 'Member Company' },
      cookies: { session: token },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('FORBIDDEN')
  })

  it('allows MEMBER to read', async () => {
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
      url: '/api/v1/companies',
      cookies: { session: token },
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('input handling and error hygiene', () => {
  it('rejects oversized field values with 422', async () => {
    const { token } = await createTenant()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/companies',
      payload: { name: 'x'.repeat(300) },
      cookies: { session: token },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
  })

  it('returns the standard error envelope without stack traces', async () => {
    const { token } = await createTenant()
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/companies/co_missing',
      cookies: { session: token },
    })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.requestId).toBeDefined()
    expect(body.error.stack).toBeUndefined()
  })
})
