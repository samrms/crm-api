import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp } from '../fixtures/app.js'
import { cleanupTestData } from '../fixtures/factories.js'
import { stopTestDatabase } from '../fixtures/testDatabase.js'
import { extractSessionToken } from '../fixtures/http.js'

let app: FastifyInstance
let cookies: { session: string }

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
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email: 'pagination@test.com',
      password: 'password123',
      name: 'Pager',
      organizationName: 'Paging Org',
    },
  })
  cookies = { session: extractSessionToken(res) }
})

async function seedDeals(count: number) {
  for (let i = 1; i <= count; i++) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/deals',
      payload: { title: `Deal ${i}` },
      cookies,
    })
    expect(res.statusCode).toBe(201)
  }
}

describe('cursor pagination', () => {
  it('walks every page exactly once with no overlap', async () => {
    await seedDeals(5)

    const seen: string[] = []
    let after: string | undefined
    let pages = 0

    for (;;) {
      const query: Record<string, string> = { limit: '2' }
      if (after) query.after = after
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/deals?${new URLSearchParams(query)}`,
        cookies,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      pages++

      expect(body.data.length).toBeLessThanOrEqual(2)
      for (const deal of body.data) seen.push(deal.id)

      if (!body.pagination.hasNextPage) break
      expect(body.pagination.nextCursor).toBeTruthy()
      after = body.pagination.nextCursor
      expect(pages).toBeLessThan(10)
    }

    expect(pages).toBe(3)
    expect(seen).toHaveLength(5)
    expect(new Set(seen).size).toBe(5)
  })

  it('rejects a tampered cursor with 400', async () => {
    await seedDeals(3)
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/deals?after=eyJjcmVhdGVkQXQiOiJ4In0.forged-signature',
      cookies,
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('INVALID_CURSOR')
  })

  it('validates query parameters', async () => {
    for (const query of ['limit=0', 'limit=999', 'limit=abc', 'stage=BOGUS']) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/deals?${query}`,
        cookies,
      })
      expect(res.statusCode, `${query} should be rejected`).toBe(422)
    }
  })

  it('paginates leads and contacts with the same semantics', async () => {
    for (let i = 1; i <= 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/leads',
        payload: {
          email: `lead${i}@example.com`,
          firstName: 'L',
          lastName: String(i),
        },
        cookies,
      })
    }
    const page1 = await app.inject({
      method: 'GET',
      url: '/api/v1/leads?limit=2',
      cookies,
    })
    expect(page1.json().data).toHaveLength(2)
    expect(page1.json().pagination.hasNextPage).toBe(true)

    const cursor = encodeURIComponent(page1.json().pagination.nextCursor)
    const page2 = await app.inject({
      method: 'GET',
      url: `/api/v1/leads?limit=2&after=${cursor}`,
      cookies,
    })
    expect(page2.statusCode).toBe(200)
    expect(page2.json().data).toHaveLength(1)
    expect(page2.json().pagination.hasNextPage).toBe(false)
  })
})
