import { describe, it, expect } from 'vitest'
import { ok, err, unwrap } from '../../../src/shared/utils/result.js'

describe('Result', () => {
  it('ok wraps a value', () => {
    const r = ok(42)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe(42)
  })

  it('err wraps an error', () => {
    const r = err('boom')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('boom')
  })

  it('unwrap returns the value for ok', () => {
    expect(unwrap(ok('value'))).toBe('value')
  })

  it('unwrap throws the contained error for err', () => {
    expect(() => unwrap(err(new Error('failed')))).toThrow('failed')
  })
})
