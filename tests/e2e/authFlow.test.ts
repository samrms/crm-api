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
  it('registers, reads /me, and returns a signed token with the session', async () => {
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

    // The token is a JWT: header.payload.signature, and the payload carries
    // identity, organization, and role.
    expect(token.split('.')).toHaveLength(3)
    const claims = JSON.parse(
      Buffer.from(token.split('.')[1]!, 'base64url').toString(),
    )
    expect(claims.org).toBe(me.json().data.organization.id)
    expect(claims.role).toBe('OWNER')
    expect(claims.exp).toBeGreaterThan(claims.iat)

    // The same token also authenticates as a bearer token.
    const viaBearer = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(viaBearer.statusCode).toBe(200)

    // Logout clears the cookie; tokens are stateless and expire on their own.
    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      cookies: { session: token },
    })
    expect(logout.statusCode).toBe(204)
    expect(String(logout.headers['set-cookie'])).toMatch(/Max-Age=0/)
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

  it('changes the password, invalidating the old one', async () => {
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

    // Stateless tokens cannot be revoked server-side: the other session stays
    // valid until it expires. The old password is rejected immediately.
    const otherSession = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      cookies: { session: secondToken },
    })
    expect(otherSession.statusCode).toBe(200)

    const newPassword = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: account.email, password: 'new-password-456' },
    })
    expect(newPassword.statusCode).toBe(200)
  })
})
