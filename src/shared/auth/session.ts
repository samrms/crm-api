import { config } from '@/shared/config.js'

/**
 * Cookie transport for the JWT. The token is signed and short-lived; keeping
 * it in an httpOnly cookie means page scripts cannot read it.
 */
export interface CookieTarget {
  setCookie: (
    name: string,
    value: string,
    options: Record<string, unknown>,
  ) => void
}

const COOKIE = 'session'

function options(maxAgeSeconds: number): Record<string, unknown> {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  }
}

export class SessionCookie {
  set(reply: CookieTarget, token: string): void {
    reply.setCookie(COOKIE, token, options(config.jwtTtlMinutes * 60))
  }

  clear(reply: CookieTarget): void {
    reply.setCookie(COOKIE, '', options(0))
  }
}

export const sessionCookie = new SessionCookie()
