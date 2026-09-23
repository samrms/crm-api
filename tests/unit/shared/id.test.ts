import { describe, it, expect } from 'vitest'
import { newId, isValidId } from '../../../src/shared/utils/id.js'

describe('newId', () => {
  it('builds a prefixed 12-character nanoid', () => {
    expect(newId('org')).toMatch(/^org_[A-Za-z0-9_-]{12}$/)
  })

  it('supports every prefix', () => {
    expect(newId('audit')).toMatch(/^audit_/)
    expect(newId('exp')).toMatch(/^exp_/)
  })

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newId('co')))
    expect(ids.size).toBe(100)
  })
})

describe('isValidId', () => {
  it('validates ids against an expected prefix', () => {
    expect(isValidId('co_abc123', 'co')).toBe(true)
    expect(isValidId('ld_abc123', 'co')).toBe(false)
  })

  it('validates generic prefixed ids', () => {
    expect(isValidId('user_xyz-789')).toBe(true)
    expect(isValidId('no-underscore')).toBe(false)
    expect(isValidId('UPPER_123')).toBe(false)
  })
})
