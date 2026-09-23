import { describe, it, expect } from 'vitest'
import {
  nowIso,
  addDays,
  isExpired,
  toDbDate,
  fromDbDate,
} from '../../../src/shared/utils/date.js'

describe('nowIso', () => {
  it('returns a parseable ISO timestamp', () => {
    const before = Date.now()
    const value = nowIso()
    expect(new Date(value).getTime()).toBeGreaterThanOrEqual(before)
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('addDays', () => {
  it('adds days without mutating the input', () => {
    const original = new Date(2026, 0, 1)
    const result = addDays(original, 7)
    expect(result).toEqual(new Date(2026, 0, 8))
    expect(original).toEqual(new Date(2026, 0, 1))
  })
})

describe('isExpired', () => {
  it('detects past and future timestamps', () => {
    expect(isExpired(new Date(Date.now() - 1000))).toBe(true)
    expect(isExpired(new Date(Date.now() + 60_000))).toBe(false)
    expect(isExpired(new Date(Date.now() - 1000).toISOString())).toBe(true)
  })
})

describe('toDbDate / fromDbDate', () => {
  it('round-trips dates through ISO strings', () => {
    const d = new Date('2026-06-15T12:30:00.000Z')
    expect(toDbDate(d)).toBe('2026-06-15T12:30:00.000Z')
    expect(fromDbDate(toDbDate(d))).toEqual(d)
    expect(fromDbDate(d)).toBe(d)
  })
})
