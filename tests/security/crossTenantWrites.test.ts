import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp } from '../fixtures/app.js'
import { cleanupTestData } from '../fixtures/factories.js'
import { stopTestDatabase } from '../fixtures/testDatabase.js'
import { extractSessionToken } from '../fixtures/http.js'

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

async function register(email: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email,
      password: 'password123',
      name: 'User',
      organizationName: `Org ${email}`,
    },
  })
  expect(res.statusCode).toBe(201)
  return {
    session: extractSessionToken(res),
    cookies: { session: extractSessionToken(res) },
  }
}

async function createCompany(cookies: { session: string }, name: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/companies',
    payload: { name },
    cookies,
  })
  expect(res.statusCode).toBe(201)
  return res.json().data
}

describe('cross-tenant reference writes', () => {
  it('rejects a contact pointing at another org company', async () => {
    const a = await register('ct-a@x.test')
    const b = await register('ct-b@x.test')
    const companyB = await createCompany(b.cookies, 'B Secret Co')

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/contacts',
      payload: {
        companyId: companyB.id,
        email: 'a@example.com',
        firstName: 'A',
        lastName: 'User',
      },
      cookies: a.cookies,
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })

  it('rejects a deal pointing at another org company, contact or lead', async () => {
    const a = await register('dl-a@x.test')
    const b = await register('dl-b@x.test')
    const companyB = await createCompany(b.cookies, 'B Co')
    const contactB = await app.inject({
      method: 'POST',
      url: '/api/v1/contacts',
      payload: { email: 'b@example.com', firstName: 'B', lastName: 'User' },
      cookies: b.cookies,
    })
    const leadB = await app.inject({
      method: 'POST',
      url: '/api/v1/leads',
      payload: { email: 'leadb@example.com', firstName: 'L', lastName: 'B' },
      cookies: b.cookies,
    })

    for (const field of ['companyId', 'contactId', 'leadId']) {
      const id =
        field === 'companyId'
          ? companyB.id
          : field === 'contactId'
            ? contactB.json().data.id
            : leadB.json().data.id

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/deals',
        payload: { title: 'Cross-tenant deal', [field]: id },
        cookies: a.cookies,
      })
      expect(res.statusCode, `${field} should be rejected`).toBe(404)
    }
  })

  it('rejects updating a contact to point at another org company', async () => {
    const a = await register('up-a@x.test')
    const b = await register('up-b@x.test')
    const companyB = await createCompany(b.cookies, 'B Co for update')

    const contactA = await app.inject({
      method: 'POST',
      url: '/api/v1/contacts',
      payload: { email: 'mine@example.com', firstName: 'M', lastName: 'A' },
      cookies: a.cookies,
    })
    const contactId = contactA.json().data.id

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/contacts/${contactId}`,
      payload: { companyId: companyB.id },
      cookies: a.cookies,
    })
    expect(res.statusCode).toBe(404)
  })

  it('still allows references within the same organization', async () => {
    const a = await register('ok-a@x.test')
    const company = await createCompany(a.cookies, 'My Co')

    const contact = await app.inject({
      method: 'POST',
      url: '/api/v1/contacts',
      payload: {
        companyId: company.id,
        email: 'ok@example.com',
        firstName: 'O',
        lastName: 'K',
      },
      cookies: a.cookies,
    })
    expect(contact.statusCode).toBe(201)

    const deal = await app.inject({
      method: 'POST',
      url: '/api/v1/deals',
      payload: {
        title: 'Legit deal',
        companyId: company.id,
        contactId: contact.json().data.id,
      },
      cookies: a.cookies,
    })
    expect(deal.statusCode).toBe(201)
  })
})
