import { describe, it, expect } from 'vitest'
import {
  hashPassword,
  verifyPassword,
} from '../../../src/shared/auth/password.ts'

describe('Password Hasher', () => {
  it('hashes and verifies password', async () => {
    const password = 'secure-password-123'
    const hash = await hashPassword(password)
    const valid = await verifyPassword(password, hash)
    expect(valid).toBe(true)
  })

  it('rejects wrong password', async () => {
    const password = 'secure-password-123'
    const wrongPassword = 'wrong-password'
    const hash = await hashPassword(password)
    const valid = await verifyPassword(wrongPassword, hash)
    expect(valid).toBe(false)
  })

  it('produces different hashes for same password (salt)', async () => {
    const password = 'secure-password-123'
    const hash1 = await hashPassword(password)
    const hash2 = await hashPassword(password)
    expect(hash1).not.toEqual(hash2)
  })

  it('uses argon2id', async () => {
    const password = 'test'
    const hash = await hashPassword(password)
    // Argon2id hashes start with $argon2id$
    expect(hash).toMatch(/^\$argon2id\$/)
  })
})
