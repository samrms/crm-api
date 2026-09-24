import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp } from '../fixtures/app.js'
import { cleanupTestData } from '../fixtures/factories.js'
import { stopTestDatabase } from '../fixtures/testDatabase.js'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildTestApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
  await stopTestDatabase()
})

beforeEach(async () => {
  await cleanupTestData()
})

describe('health endpoints', () => {
  it('GET / returns service info', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      status: 'ok',
      name: 'CRM API',
      docs: '/docs',
    })
  })

  it('GET /health is ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('ok')
    expect(res.json().timestamp).toBeDefined()
  })

  it('GET /ready reports database and redis checks', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('ready')
    expect(body.checks.database).toBe('ok')
  })

  it('GET /metrics exposes process metrics', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(typeof body.uptime).toBe('number')
    expect(body.memory).toBeDefined()
  })

  it('GET /docs/json serves the static openapi document', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' })
    expect(res.statusCode).toBe(200)
    const doc = res.json()
    expect(doc.openapi).toBe('3.0.3')
    expect(doc.info.title).toBe('Essential CRM API')
    expect(doc.tags.map((t: { name: string }) => t.name)).toEqual([
      'Auth',
      'Companies',
      'Contacts',
      'Leads',
      'Deals',
      'Imports',
      'Exports',
      'System',
    ])
    expect(
      Object.keys(doc.paths['/api/v1/companies/{id}'].get.responses),
    ).toEqual(['200', '401', '404', '429', '500'])
    expect(doc.paths['/api/v1/companies'].get.responses['422']).toBeDefined()
    expect(doc.paths['/api/v1/companies'].post.security).toEqual([
      { sessionCookie: [] },
    ])
    expect(doc.components.schemas.Error).toBeDefined()
  })
})
