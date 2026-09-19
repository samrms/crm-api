import { nanoid } from 'nanoid'
import { getTestDb, truncateAllTables } from './testDatabase.js'
import { hashPassword } from '../../src/shared/auth/password.js'

let currentOrgId: string | null = null
let currentUserId: string | null = null

export async function createTestOrganization(
  overrides: Partial<{ id: string; name: string; slug: string }> = {},
) {
  const db = getTestDb()
  const id = overrides.id ?? `org_${nanoid(12)}`
  const name = overrides.name ?? `Test Org ${nanoid(6)}`
  const slug =
    overrides.slug ??
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

  await db
    .insertInto('organizations')
    .values({
      id,
      name,
      slug,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute()

  currentOrgId = id
  return { id, name, slug }
}

export async function createTestUser(
  overrides: Partial<{
    id: string
    email: string
    name: string
    password: string
  }> = {},
) {
  const db = getTestDb()
  const id = overrides.id ?? `user_${nanoid(12)}`
  const email = overrides.email ?? `test${nanoid(6)}@example.com`
  const name = overrides.name ?? 'Test User'
  const password = overrides.password ?? 'password123'
  const passwordHash = await hashPassword(password)

  await db
    .insertInto('users')
    .values({
      id,
      email,
      name,
      password_hash: passwordHash,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute()

  currentUserId = id
  return { id, email, name, password }
}

export async function createTestMembership(
  overrides: Partial<{
    userId: string
    organizationId: string
    role: 'OWNER' | 'ADMIN' | 'MEMBER'
  }> = {},
) {
  const db = getTestDb()
  const userId =
    overrides.userId ?? currentUserId ?? (await createTestUser()).id
  const organizationId =
    overrides.organizationId ??
    currentOrgId ??
    (await createTestOrganization()).id
  const role = overrides.role ?? 'OWNER'

  await db
    .insertInto('memberships')
    .values({
      id: `mem_${nanoid(12)}`,
      user_id: userId,
      organization_id: organizationId,
      role,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute()

  return { userId, organizationId, role }
}

export async function createTestSession(
  userId: string,
  organizationId: string,
) {
  const db = getTestDb()
  const sessionId = `sess_${nanoid(12)}`
  const token = nanoid(32)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await db
    .insertInto('sessions')
    .values({
      id: sessionId,
      token,
      user_id: userId,
      organization_id: organizationId,
      expires_at: expiresAt,
      created_at: new Date(),
    })
    .execute()

  return { sessionId, token, expiresAt }
}

export async function createTestCompany(
  organizationId: string,
  overrides: Partial<{ id: string; name: string; domain: string }> = {},
) {
  const db = getTestDb()
  const id = overrides.id ?? `co_${nanoid(12)}`

  await db
    .insertInto('companies')
    .values({
      id,
      organization_id: organizationId,
      name: overrides.name ?? `Company ${nanoid(6)}`,
      domain: overrides.domain ?? `company${nanoid(6)}.com`,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute()

  return { id, organizationId, name: overrides.name }
}

export async function createTestContact(
  organizationId: string,
  companyId: string,
  overrides: Partial<{
    email: string
    firstName: string
    lastName: string
  }> = {},
) {
  const db = getTestDb()
  const id = `ct_${nanoid(12)}`

  await db
    .insertInto('contacts')
    .values({
      id,
      organization_id: organizationId,
      company_id: companyId,
      email: overrides.email ?? `contact${nanoid(6)}@example.com`,
      firstName: overrides.firstName ?? 'John',
      lastName: overrides.lastName ?? 'Doe',
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute()

  return { id, organizationId, companyId }
}

export async function createTestLead(
  organizationId: string,
  overrides: Partial<{
    email: string
    firstName: string
    lastName: string
    status: string
  }> = {},
) {
  const db = getTestDb()
  const id = `ld_${nanoid(12)}`

  await db
    .insertInto('leads')
    .values({
      id,
      organization_id: organizationId,
      email: overrides.email ?? `lead${nanoid(6)}@example.com`,
      firstName: overrides.firstName ?? 'Jane',
      lastName: overrides.lastName ?? 'Smith',
      status: overrides.status ?? 'NEW',
      version: 1,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute()

  return { id, organizationId }
}

export async function createTestDeal(
  organizationId: string,
  overrides: Partial<{
    title: string
    stage: string
    companyId: string
    contactId: string
  }> = {},
) {
  const db = getTestDb()
  const id = `dl_${nanoid(12)}`

  await db
    .insertInto('deals')
    .values({
      id,
      organization_id: organizationId,
      title: overrides.title ?? `Deal ${nanoid(6)}`,
      stage: overrides.stage ?? 'NEW',
      companyId: overrides.companyId ?? null,
      contactId: overrides.contactId ?? null,
      version: 1,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute()

  return { id, organizationId }
}

export async function cleanupTestData() {
  await truncateAllTables()
  currentOrgId = null
  currentUserId = null
}

export function getCurrentOrgId(): string | null {
  return currentOrgId
}

export function getCurrentUserId(): string | null {
  return currentUserId
}
