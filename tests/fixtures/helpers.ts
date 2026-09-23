import { buildApp } from '../../src/app.js'
import {
  startTestDatabase,
  stopTestDatabase,
  getTestDb,
} from './testDatabase.js'
import {
  createTestOrganization,
  createTestUser,
  createTestMembership,
  cleanupTestData,
} from './factories.js'

export async function setupIntegration() {
  await startTestDatabase()
  return {
    db: getTestDb(),
    cleanup: cleanupTestData,
    teardown: stopTestDatabase,
  }
}

export async function buildTestApp() {
  await startTestDatabase()
  const app = await buildApp()
  return app
}

export async function createAuthContext(
  role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'OWNER',
) {
  const org = await createTestOrganization()
  const user = await createTestUser()
  await createTestMembership({ userId: user.id, organizationId: org.id, role })
  return { org, user, role }
}

export function authHeaders(token: string): Record<string, string> {
  return { cookie: `session=${token}` }
}

export function expectPagination(body: unknown) {
  const b = body as { pagination?: { limit: number; hasNextPage: boolean } }
  if (!b.pagination) throw new Error('Missing pagination in response')
  return b.pagination
}

export function expectHateoas(body: unknown, link: string) {
  const b = body as { _links?: Record<string, unknown> }
  if (!b._links?.[link]) throw new Error(`Missing HATEOAS link: ${link}`)
  return b._links[link]
}
