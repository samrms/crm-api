import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  startTestDatabase,
  stopTestDatabase,
  getTestDb,
} from '../fixtures/testDatabase.js'
import {
  createTestOrganization,
  createTestUser,
  createTestMembership,
} from '../fixtures/factories.js'
import { PostgresMemberRepository } from '../../src/modules/organizations/infrastructure/PostgresMemberRepository.js'

describe('Integration: Member repository', () => {
  beforeAll(async () => {
    await startTestDatabase()
  })

  afterAll(async () => {
    await stopTestDatabase()
  })

  it('listWithUsers returns memberships enriched with user email and name', async () => {
    const org = await createTestOrganization()
    const user = await createTestUser()
    await createTestMembership({
      userId: user.id,
      organizationId: org.id,
      role: 'ADMIN',
    })

    const repo = new PostgresMemberRepository(getTestDb())
    const members = await repo.listWithUsers(org.id)

    expect(members).toHaveLength(1)
    expect(members[0].role).toBe('ADMIN')
    expect(members[0].user_email).toBe(user.email)
    expect(members[0].user_name).toBe(user.name)
    expect(members[0].user_email).toContain('@')
    expect(members[0]).not.toHaveProperty('password_hash')
  })

  it('listWithUsers is scoped to the organization', async () => {
    const orgA = await createTestOrganization()
    const orgB = await createTestOrganization()
    const user = await createTestUser()
    await createTestMembership({ userId: user.id, organizationId: orgA.id })

    const repo = new PostgresMemberRepository(getTestDb())

    expect(await repo.listWithUsers(orgA.id)).toHaveLength(1)
    expect(await repo.listWithUsers(orgB.id)).toHaveLength(0)
  })
})
