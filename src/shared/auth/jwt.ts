import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from '@/shared/config.js'
import { UnauthorizedError } from '@/shared/errors/AppError.js'
import type { Role } from '@/shared/database/types.js'

/**
 * Minimal HS256 JWT. Implemented directly on node:crypto rather than pulling
 * in a library: the algorithm is a base64url header, a base64url payload, and
 * an HMAC-SHA256 signature — the same primitives already used by CursorEncoder.
 *
 * Tokens are stateless, which is the point: authentication costs no database
 * query. The cost is that a token cannot be revoked before it expires. See
 * ADR 003 for the trade-off and the mitigation (short TTL).
 */

export interface TokenClaims {
  sub: string
  org: string
  role: Role
  iat: number
  exp: number
}

const HEADER = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))

function base64Url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url')
}

function sign(data: string): string {
  return createHmac('sha256', config.sessionSecret)
    .update(data)
    .digest('base64url')
}

export function issueToken(claims: {
  userId: string
  organizationId: string
  role: Role
}): { token: string; expiresAt: Date } {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + config.jwtTtlMinutes * 60
  const payload = base64Url(
    JSON.stringify({
      sub: claims.userId,
      org: claims.organizationId,
      role: claims.role,
      iat,
      exp,
    }),
  )
  const body = `${HEADER}.${payload}`
  return {
    token: `${body}.${sign(body)}`,
    expiresAt: new Date(exp * 1000),
  }
}

export function verifyToken(token: string): TokenClaims {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new UnauthorizedError('Invalid session token')
  }
  const [header, payload, signature] = parts as [string, string, string]

  const expected = sign(`${header}.${payload}`)
  const given = Buffer.from(signature)
  const want = Buffer.from(expected)
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    throw new UnauthorizedError('Invalid session token')
  }

  let claims: TokenClaims
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch {
    throw new UnauthorizedError('Invalid session token')
  }

  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) {
    throw new UnauthorizedError('Session expired')
  }
  if (typeof claims.sub !== 'string' || typeof claims.org !== 'string') {
    throw new UnauthorizedError('Invalid session token')
  }
  return claims
}
