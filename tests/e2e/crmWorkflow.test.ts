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

async function registerAndLogin(email: string) {
  const register = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email,
      password: 'password123',
      name: 'Workflow User',
      organizationName: `Org ${email}`,
    },
  })
  expect(register.statusCode).toBe(201)
  return {
    token: extractSessionToken(register),
    cookies: { session: extractSessionToken(register) },
  }
}

describe('e2e: CRM workflow', () => {
  it('register -> company -> contact -> lead -> qualify -> convert -> deal -> win', async () => {
    const { cookies } = await registerAndLogin('workflow@example.com')

    const companyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/companies',
      payload: { name: 'Acme Corp', domain: 'acme.com' },
      cookies,
    })
    expect(companyRes.statusCode).toBe(201)
    const company = companyRes.json().data

    const contactRes = await app.inject({
      method: 'POST',
      url: '/api/v1/contacts',
      payload: {
        companyId: company.id,
        email: 'john@acme.com',
        firstName: 'John',
        lastName: 'Doe',
        title: 'CTO',
      },
      cookies,
    })
    expect(contactRes.statusCode).toBe(201)

    const leadRes = await app.inject({
      method: 'POST',
      url: '/api/v1/leads',
      payload: {
        email: 'john@acme.com',
        firstName: 'John',
        lastName: 'Doe',
        company: 'Acme Corp',
        source: 'website',
      },
      cookies,
    })
    expect(leadRes.statusCode).toBe(201)
    const lead = leadRes.json().data
    expect(lead.status).toBe('NEW')

    const qualifyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/leads/${lead.id}/qualify`,
      cookies,
    })
    expect(qualifyRes.statusCode).toBe(200)
    expect(qualifyRes.json().data.status).toBe('QUALIFIED')

    const convertRes = await app.inject({
      method: 'POST',
      url: `/api/v1/leads/${lead.id}/convert`,
      payload: { dealTitle: 'Enterprise Deal', dealValue: 50_000 },
      cookies,
    })
    expect(convertRes.statusCode).toBe(201)
    const conversion = convertRes.json().data
    expect(conversion.lead.status).toBe('CONVERTED')
    expect(conversion.deal.title).toBe('Enterprise Deal')
    expect(conversion.company.name).toBe('Acme Corp')
    expect(conversion.contact.email).toBe('john@acme.com')

    const dealId = conversion.deal.id
    for (const stage of ['QUALIFIED', 'PROPOSAL', 'NEGOTIATION']) {
      const advance = await app.inject({
        method: 'POST',
        url: `/api/v1/deals/${dealId}/advance`,
        payload: { stage },
        cookies,
      })
      expect(advance.statusCode).toBe(200)
      expect(advance.json().data.stage).toBe(stage)
    }

    const winRes = await app.inject({
      method: 'POST',
      url: `/api/v1/deals/${dealId}/win`,
      cookies,
    })
    expect(winRes.statusCode).toBe(200)
    expect(winRes.json().data.stage).toBe('WON')

    const lost = await app.inject({
      method: 'POST',
      url: `/api/v1/deals/${dealId}/lose`,
      cookies,
    })
    expect(lost.statusCode).toBe(422)
  })

  it('rejects invalid deal and lead transitions', async () => {
    const { cookies } = await registerAndLogin('states@example.com')

    const dealRes = await app.inject({
      method: 'POST',
      url: '/api/v1/deals',
      payload: { title: 'Fresh Deal', value: 1_000 },
      cookies,
    })
    const deal = dealRes.json().data

    const prematureWin = await app.inject({
      method: 'POST',
      url: `/api/v1/deals/${deal.id}/win`,
      cookies,
    })
    expect(prematureWin.statusCode).toBe(422)

    const prematureLose = await app.inject({
      method: 'POST',
      url: `/api/v1/deals/${deal.id}/lose`,
      cookies,
    })
    expect(prematureLose.statusCode).toBe(422)

    const lost = await app.inject({
      method: 'POST',
      url: `/api/v1/deals/${deal.id}/lose`,
      payload: { stage: 'NEGOTIATION' },
      cookies,
    })
    expect(lost.statusCode).toBe(422)
  })

  it('walks a deal to LOST through the pipeline', async () => {
    const { cookies } = await registerAndLogin('lost@example.com')
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/deals',
      payload: { title: 'Will Lose', value: 1_000 },
      cookies,
    })
    const deal = created.json().data
    for (const stage of ['QUALIFIED', 'PROPOSAL', 'NEGOTIATION']) {
      await app.inject({
        method: 'POST',
        url: `/api/v1/deals/${deal.id}/advance`,
        payload: { stage },
        cookies,
      })
    }
    const lose = await app.inject({
      method: 'POST',
      url: `/api/v1/deals/${deal.id}/lose`,
      cookies,
    })
    expect(lose.statusCode).toBe(200)
    expect(lose.json().data.stage).toBe('LOST')
  })
})

describe('e2e: import and export endpoints', () => {
  it('accepts an import (202) and exposes its status', async () => {
    const { cookies } = await registerAndLogin('importer@example.com')
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/imports',
      payload: { type: 'companies', content: 'name\nAcme\nGlobex\n' },
      cookies,
    })
    expect(create.statusCode).toBe(202)
    const job = create.json().data
    expect(job.id).toMatch(/^imp_/)
    expect(job.status).toBe('PENDING')

    const status = await app.inject({
      method: 'GET',
      url: `/api/v1/imports/${job.id}`,
      cookies,
    })
    expect(status.statusCode).toBe(200)
    expect(status.json().data.id).toBe(job.id)
  })

  it('rejects an invalid import type with 422', async () => {
    const { cookies } = await registerAndLogin('badimport@example.com')
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/imports',
      payload: { type: 'invalid_type' },
      cookies,
    })
    expect(res.statusCode).toBe(422)
  })

  it('accepts an export (202), exposes status and refuses early download', async () => {
    const { cookies } = await registerAndLogin('exporter@example.com')
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/exports',
      payload: { type: 'companies' },
      cookies,
    })
    expect(create.statusCode).toBe(202)
    const job = create.json().data
    expect(job.id).toMatch(/^exp_/)

    const status = await app.inject({
      method: 'GET',
      url: `/api/v1/exports/${job.id}`,
      cookies,
    })
    expect(status.statusCode).toBe(200)

    const download = await app.inject({
      method: 'GET',
      url: `/api/v1/exports/${job.id}/download`,
      cookies,
    })
    expect(download.statusCode).toBe(409)
  })
})
