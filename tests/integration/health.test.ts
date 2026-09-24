import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest'
import type { FastifyInstance } from 'fastify'

// Redis is an external service. The suite is hermetic, so the readiness
// probe is exercised against a controllable stub rather than a live server.
const { ping } = vi.hoisted(() => ({ ping: vi.fn() }))
vi.mock('@/shared/cache/redis.js', () => ({
  redisClient: { ping, close: vi.fn() },
}))

const { buildTestApp } = await import('../fixtures/app.js')
const { cleanupTestData } = await import('../fixtures/factories.js')
const { stopTestDatabase } = await import('../fixtures/testDatabase.js')

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
  ping.mockReset()
  ping.mockResolvedValue('PONG')
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

  it('GET /ready is 200 when every dependency responds', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('ready')
    expect(body.checks).toEqual({ database: 'ok', redis: 'ok' })
  })

  it('GET /ready is 503 and names the failing dependency', async () => {
    ping.mockRejectedValue(new Error('ECONNREFUSED'))

    const res = await app.inject({ method: 'GET', url: '/ready' })
    expect(res.statusCode).toBe(503)
    const body = res.json()
    expect(body.status).toBe('degraded')
    expect(body.checks).toEqual({ database: 'ok', redis: 'unavailable' })
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
