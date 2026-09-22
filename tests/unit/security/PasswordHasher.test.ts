import { describe, it, expect, vi } from 'vitest'

describe('Unit: Security', () => {
  it('password hasher verifies', async () => {
    const { hash, verify } =
      await import('../../../src/shared/auth/password.js')
    const h = await hash('secret')
    expect(await verify('secret', h)).toBe(true)
  })
})
