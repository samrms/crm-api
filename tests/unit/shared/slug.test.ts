import { describe, it, expect } from 'vitest'
import { toSlug, isValidSlug } from '../../../src/shared/utils/slug.js'

describe('toSlug', () => {
  it('lowercases and replaces non-alphanumerics with hyphens', () => {
    expect(toSlug('Hello, World!')).toBe('hello-world')
  })

  it('trims leading and trailing separators', () => {
    expect(toSlug(' -- Foo Bar -- ')).toBe('foo-bar')
  })

  it('collapses runs of separators into one hyphen', () => {
    expect(toSlug('a  b___c')).toBe('a-b-c')
  })

  it('truncates to 80 characters', () => {
    expect(toSlug('a'.repeat(200))).toHaveLength(80)
  })
})

describe('isValidSlug', () => {
  it('accepts lowercase hyphenated slugs', () => {
    expect(isValidSlug('my-company-name')).toBe(true)
  })

  it('rejects leading or trailing hyphens', () => {
    expect(isValidSlug('-leading')).toBe(false)
    expect(isValidSlug('trailing-')).toBe(false)
  })

  it('rejects consecutive hyphens, uppercase, and single characters', () => {
    expect(isValidSlug('a--b')).toBe(false)
    expect(isValidSlug('Abc')).toBe(false)
    expect(isValidSlug('a')).toBe(false)
  })

  it('rejects slugs longer than 80 characters', () => {
    expect(isValidSlug('a'.repeat(81))).toBe(false)
  })
})
