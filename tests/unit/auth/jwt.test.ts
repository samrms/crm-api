import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { issueToken, verifyToken } from '../../../src/shared/auth/jwt.ts'
import { config } from '../../../src/shared/config.ts'

const encode = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64url')

describe('jwt', () => {
  const claims = {
    userId: 'user_1',
    organizationId: 'org_1',
    role: 'OWNER' as const,
  }

  it('issues a three-part token that verifies back to its claims', () => {
    const { token, expiresAt } = issueToken(claims)
    expect(token.split('.')).toHaveLength(3)

    const verified = verifyToken(token)
    expect(verified.sub).toBe('user_1')
    expect(verified.org).toBe('org_1')
    expect(verified.role).toBe('OWNER')
    expect(expiresAt.getTime()).toBe(verified.exp * 1000)
  })

  it('sets an expiry from the configured TTL', () => {
    const { token } = issueToken(claims)
    const verified = verifyToken(token)
    const ttlSeconds = verified.exp - verified.iat
    expect(ttlSeconds).toBe(config.jwtTtlMinutes * 60)
  })

  it('rejects a token whose signature was tampered with', () => {
    const { token } = issueToken(claims)
    const [header, payload, signature] = token.split('.') as [
      string,
      string,
      string,
    ]
    const forged = `${header}.${payload}.${signature.slice(0, -1)}x`
    expect(() => verifyToken(forged)).toThrow(/Invalid session token/)
  })

  it('rejects a payload edited to a different organization', () => {
    const { token } = issueToken(claims)
    const [header, , signature] = token.split('.') as [string, string, string]
    const tampered = `${header}.${encode({ ...claims, sub: 'user_x', org: 'org_x', role: 'OWNER', iat: 1, exp: 9999999999 })}.${signature}`
    expect(() => verifyToken(tampered)).toThrow(/Invalid session token/)
  })

  it('rejects an expired token', () => {
    const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
      sub: 'user_1',
      org: 'org_1',
      role: 'OWNER',
      iat: 0,
      exp: 1,
    })}`
    const signature = createHmac('sha256', config.sessionSecret)
      .update(body)
      .digest('base64url')
    expect(() => verifyToken(`${body}.${signature}`)).toThrow(/expired/)
  })

  it('rejects malformed input', () => {
    expect(() => verifyToken('not-a-token')).toThrow(/Invalid session token/)
    expect(() => verifyToken('a.b')).toThrow(/Invalid session token/)
  })
})
