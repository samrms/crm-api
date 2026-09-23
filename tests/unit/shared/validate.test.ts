import { describe, it, expect } from 'vitest'
import {
  isEmail,
  isNonEmpty,
  assertNonEmpty,
  clamp,
} from '../../../src/shared/utils/validate.js'

describe('isEmail', () => {
  it('accepts simple addresses', () => {
    expect(isEmail('user@example.com')).toBe(true)
    expect(isEmail('first.last+tag@sub.example.co')).toBe(true)
  })

  it('rejects malformed addresses', () => {
    expect(isEmail('plain')).toBe(false)
    expect(isEmail('missing@tld')).toBe(false)
    expect(isEmail('spaces in@x.com')).toBe(false)
    expect(isEmail('@x.com')).toBe(false)
  })
})

describe('isNonEmpty / assertNonEmpty', () => {
  it('treats whitespace-only strings as empty', () => {
    expect(isNonEmpty('  ')).toBe(false)
    expect(isNonEmpty('a')).toBe(true)
  })

  it('assertNonEmpty throws with the field name', () => {
    expect(() => assertNonEmpty('   ', 'name')).toThrow(
      'name must not be empty',
    )
    expect(() => assertNonEmpty('ok', 'name')).not.toThrow()
  })
})

describe('clamp', () => {
  it('clamps into the inclusive range', () => {
    expect(clamp(5, 1, 10)).toBe(5)
    expect(clamp(-3, 1, 10)).toBe(1)
    expect(clamp(99, 1, 10)).toBe(10)
  })
})
