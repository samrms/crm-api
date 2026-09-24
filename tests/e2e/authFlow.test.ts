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

const account = {
  email: 'auth-flow@example.com',
  password: 'password123',
  name: 'Auth Flow',
  organizationName: 'Auth Flow Org',
}

describe('e2e: authentication flow', () => {
  it('registers, reads /me, logs out and rejects the dead session', async () => {
    const register = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: account,
    })
    expect(register.statusCode).toBe(201)
    const token = extractSessionToken(register)
    expect(register.json().data.user.email).toBe(account.email)
    expect(register.json().data.organization.name).toBe(
      account.organizationName,
    )

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      cookies: { session: token },
    })
    expect(me.statusCode).toBe(200)
    expect(me.json().data.user.email).toBe(account.email)
    expect(me.json().data.role).toBe('OWNER')
    expect(me.json().data.organization.name).toBe(account.organizationName)
    expect(me.json().data.organization.slug).toBe('auth-flow-org')

    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      cookies: { session: token },
    })
    expect(logout.statusCode).toBe(204)

    const after = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      cookies: { session: token },
    })
    expect(after.statusCode).toBe(401)
  })

  it('logs in with valid credentials and rejects wrong ones', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: account,
    })

    const bad = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: account.email, password: 'wrong-password' },
    })
    expect(bad.statusCode).toBe(401)

    const good = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: account.email, password: account.password },
    })
    expect(good.statusCode).toBe(200)
    expect(extractSessionToken(good)).toBeTruthy()
  })

  it('rejects duplicate registrations with 409', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: account,
    })
    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: account,
    })
    expect(duplicate.statusCode).toBe(409)
    expect(duplicate.json().error.code).toBe('CONFLICT')
  })

  it('changes the password and invalidates other sessions', async () => {
    const register = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: account,
    })
    const firstToken = extractSessionToken(register)

    const secondLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: account.email, password: account.password },
    })
    const secondToken = extractSessionToken(secondLogin)

    const change = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/change',
      payload: {
        currentPassword: account.password,
        password: 'new-password-456',
      },
      cookies: { session: firstToken },
    })
    expect(change.statusCode).toBe(200)

    const oldPassword = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: account.email, password: account.password },
    })
    expect(oldPassword.statusCode).toBe(401)

    const revokedSession = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      cookies: { session: secondToken },
    })
    expect(revokedSession.statusCode).toBe(401)

    const newPassword = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: account.email, password: 'new-password-456' },
    })
    expect(newPassword.statusCode).toBe(200)
  })
})
