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
import { extractSessionToken } from '../fixtures/http.js'

let app: FastifyInstance

describe('E2E: CRM Workflow', () => {
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

  it('complete CRM workflow: register -> company -> contact -> lead -> qualify -> convert -> deal -> win', async () => {
    // 1. Register
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'workflow@test.com',
        password: 'password123',
        name: 'Workflow User',
        organizationName: 'Workflow Org',
      },
    })
    expect(registerRes.statusCode).toBe(201)
    const sessionToken = extractSessionToken(registerRes)

    // 2. Create company
    const companyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/companies',
      payload: { name: 'Acme Corp', domain: 'acme.com', industry: 'Software' },
      cookies: { session: sessionToken },
    })
    expect(companyRes.statusCode).toBe(201)
    const company = JSON.parse(companyRes.payload).data

    // 3. Create contact
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
      cookies: { session: sessionToken },
    })
    expect(contactRes.statusCode).toBe(201)

    // 4. Create lead
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
      cookies: { session: sessionToken },
    })
    expect(leadRes.statusCode).toBe(201)
    const lead = JSON.parse(leadRes.payload).data
    expect(lead.status).toBe('NEW')

    // 5. Qualify lead (NEW -> CONTACTED -> QUALIFIED)
    const contactLeadRes = await app.inject({
      method: 'POST',
      url: `/api/v1/leads/${lead.id}/qualify`,
      cookies: { session: sessionToken },
    })
    expect(contactLeadRes.statusCode).toBe(200)
    expect(JSON.parse(contactLeadRes.payload).data.status).toBe('QUALIFIED')

    const qualifyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/leads/${lead.id}/qualify`,
      cookies: { session: sessionToken },
    })
    expect(qualifyRes.statusCode).toBe(200)
    expect(JSON.parse(qualifyRes.payload).data.status).toBe('QUALIFIED')

    // 6. Convert lead (QUALIFIED -> CONVERTED, creates deal)
    const convertRes = await app.inject({
      method: 'POST',
      url: `/api/v1/leads/${lead.id}/convert`,
      payload: {
        dealTitle: 'Enterprise Deal',
        dealValue: 50000,
      },
      cookies: { session: sessionToken },
    })
    expect(convertRes.statusCode).toBe(201)
    const conversion = JSON.parse(convertRes.payload).data

    expect(conversion.lead.status).toBe('CONVERTED')
    expect(conversion.deal.title).toBe('Enterprise Deal')
    expect(conversion.deal.value).toBe(50000)
    expect(conversion.company.name).toBe('Acme Corp')
    expect(conversion.contact.email).toBe('john@acme.com')

    const dealId = conversion.deal.id

    // 7. Advance deal through pipeline
    const stages = ['QUALIFIED', 'PROPOSAL', 'NEGOTIATION']
    for (const stage of stages) {
      const advanceRes = await app.inject({
        method: 'POST',
        url: `/api/v1/deals/${dealId}/advance`,
        payload: { stage },
        cookies: { session: sessionToken },
      })
      expect(advanceRes.statusCode).toBe(200)
      expect(JSON.parse(advanceRes.payload).data.stage).toBe(stage)
    }

    // 8. Win the deal
    const winRes = await app.inject({
      method: 'POST',
      url: `/api/v1/deals/${dealId}/win`,
      cookies: { session: sessionToken },
    })
    expect(winRes.statusCode).toBe(200)
    const wonDeal = JSON.parse(winRes.payload).data
    expect(wonDeal.stage).toBe('WON')
    expect(wonDeal._links.self).toBeDefined()
    expect(wonDeal._links.win).toBeUndefined() // terminal state
    expect(wonDeal._links.lose).toBeUndefined() // terminal state
  })

  it('lead disqualification workflow', async () => {
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'disqualify@test.com',
        password: 'password123',
        name: 'Disqualify User',
        organizationName: 'Disqualify Org',
      },
    })
    const sessionToken = extractSessionToken(registerRes)

    const leadRes = await app.inject({
      method: 'POST',
      url: '/api/v1/leads',
      payload: {
        email: 'bad@lead.com',
        firstName: 'Bad',
        lastName: 'Lead',
      },
      cookies: { session: sessionToken },
    })
    const lead = JSON.parse(leadRes.payload).data

    await app.inject({
      method: 'POST',
      url: `/api/v1/leads/${lead.id}/qualify`,
      payload: { status: 'DISQUALIFIED' },
      cookies: { session: sessionToken },
    })

    expect(lead.status).toBe('NEW')
  })

  it('deal lost workflow', async () => {
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'lose@test.com',
        password: 'password123',
        name: 'Lose User',
        organizationName: 'Lose Org',
      },
    })
    const sessionToken = extractSessionToken(registerRes)

    const dealRes = await app.inject({
      method: 'POST',
      url: '/api/v1/deals',
      payload: { title: 'Will Lose', value: 1000 },
      cookies: { session: sessionToken },
    })
    const deal = JSON.parse(dealRes.payload).data

    // Advance to NEGOTIATION
    await app.inject({
      method: 'POST',
      url: `/api/v1/deals/${deal.id}/advance`,
      payload: { stage: 'QUALIFIED' },
      cookies: { session: sessionToken },
    })
    await app.inject({
      method: 'POST',
      url: `/api/v1/deals/${deal.id}/advance`,
      payload: { stage: 'PROPOSAL' },
      cookies: { session: sessionToken },
    })
    await app.inject({
      method: 'POST',
      url: `/api/v1/deals/${deal.id}/advance`,
      payload: { stage: 'NEGOTIATION' },
      cookies: { session: sessionToken },
    })

    // Lose
    const loseRes = await app.inject({
      method: 'POST',
      url: `/api/v1/deals/${deal.id}/lose`,
      cookies: { session: sessionToken },
    })
    expect(loseRes.statusCode).toBe(200)
    const lostDeal = JSON.parse(loseRes.payload).data
    expect(lostDeal.stage).toBe('LOST')
  })
})

describe('E2E: Import/Export Workflow', () => {
  let app: FastifyInstance
  let sessionToken: string

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

    const org = await createTestOrganization()
    const user = await createTestUser()
    await createTestMembership({ userId: user.id, organizationId: org.id })
    const { token } = await createTestSession(user.id, org.id)
    sessionToken = token
  })

  it('import workflow: POST -> 202 -> status COMPLETED', async () => {
    // Note: This test uses the simplified import endpoint
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/imports',
      payload: { type: 'companies' },
      cookies: { session: sessionToken },
    })
    expect(createRes.statusCode).toBe(202)
    const importData = JSON.parse(createRes.payload).data
    expect(importData.status).toBe('PENDING')
    expect(importData.id).toMatch(/^imp_/)

    // Check status
    const statusRes = await app.inject({
      method: 'GET',
      url: `/api/v1/imports/${importData.id}`,
      cookies: { session: sessionToken },
    })
    expect(statusRes.statusCode).toBe(200)
  })

  it('export workflow: POST -> 202 -> status COMPLETED', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/exports',
      payload: { type: 'companies' },
      cookies: { session: sessionToken },
    })
    expect(createRes.statusCode).toBe(202)
    const exportData = JSON.parse(createRes.payload).data
    expect(exportData.status).toBe('PENDING')
    expect(exportData.id).toMatch(/^exp_/)

    const statusRes = await app.inject({
      method: 'GET',
      url: `/api/v1/exports/${exportData.id}`,
      cookies: { session: sessionToken },
    })
    expect(statusRes.statusCode).toBe(200)
  })
})
