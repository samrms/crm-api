import { nanoid } from 'nanoid'
import { getTestDb, truncateAllTables } from './testDatabase.js'
import { hashPassword } from '../../src/shared/auth/password.js'
import { issueToken } from '../../src/shared/auth/jwt.js'
import type { Role } from '../../src/shared/database/types.js'

let currentOrgId: string | null = null
let currentUserId: string | null = null

export async function createTestOrganization(
  overrides: Partial<{ id: string; name: string; slug: string }> = {},
) {
  const db = getTestDb()
  const id = overrides.id ?? `org_${nanoid(12)}`
  const name = overrides.name ?? `Test Org ${nanoid(6)}`
  const slug = overrides.slug ?? id.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  await db
    .insertInto('organizations')
    .values({ id, name, slug, created_at: new Date(), updated_at: new Date() })
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
    role: Role
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

export function createTestSession(
  userId: string,
  organizationId: string,
  role: Role = 'OWNER',
) {
  const { token, expiresAt } = issueToken({
    userId,
    organizationId,
    role,
  })
  return { token, expiresAt }
}

export async function createTestCompany(
  organizationId: string,
  overrides: Partial<{ id: string; name: string; domain: string }> = {},
) {
  const db = getTestDb()
  const id = overrides.id ?? `co_${nanoid(12)}`
  const name = overrides.name ?? `Company ${nanoid(6)}`
  await db
    .insertInto('companies')
    .values({
      id,
      organization_id: organizationId,
      name,
      domain: overrides.domain ?? null,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute()
  return { id, organizationId, name }
}

export async function createTestContact(
  organizationId: string,
  companyId: string | null,
  overrides: Partial<{
    id: string
    email: string
    firstName: string
    lastName: string
  }> = {},
) {
  const db = getTestDb()
  const id = overrides.id ?? `ct_${nanoid(12)}`
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
    id: string
    email: string
    firstName: string
    lastName: string
    status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'DISQUALIFIED'
  }> = {},
) {
  const db = getTestDb()
  const id = overrides.id ?? `ld_${nanoid(12)}`
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
    id: string
    title: string
    stage: 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST'
    companyId: string | null
    contactId: string | null
  }> = {},
) {
  const db = getTestDb()
  const id = overrides.id ?? `dl_${nanoid(12)}`
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

export async function cleanupTestData(): Promise<void> {
  await truncateAllTables()
  currentOrgId = null
  currentUserId = null
}
