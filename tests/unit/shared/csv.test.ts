import { describe, it, expect } from 'vitest'
import {
  parseCsv,
  toCsv,
  sanitizeCsvValue,
} from '../../../src/shared/utils/csv.js'

describe('parseCsv', () => {
  it('parses rows, trims cells, and drops empty rows', () => {
    const text = 'name, email \nAcme, a@b.co\n\nNext, n@x.co\n'
    expect(parseCsv(text)).toEqual([
      ['name', 'email'],
      ['Acme', 'a@b.co'],
      ['Next', 'n@x.co'],
    ])
  })

  it('handles quoted cells with commas, newlines, and escaped quotes', () => {
    const text = '"Acme, Inc.","Line 1\nLine 2","She said ""hi"""'
    expect(parseCsv(text)).toEqual([
      ['Acme, Inc.', 'Line 1\nLine 2', 'She said "hi"'],
    ])
  })

  it('parses CRLF line endings', () => {
    expect(parseCsv('a,b\r\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })
})

describe('toCsv', () => {
  it('quotes cells containing commas, quotes, or newlines', () => {
    const csv = toCsv([
      ['name', 'note'],
      ['Acme, Inc.', 'She said "hi"'],
      ['line', 'a\nb'],
    ])
    expect(csv).toBe('name,note\n"Acme, Inc.","She said ""hi"""\nline,"a\nb"')
  })

  it('round-trips through parseCsv', () => {
    const rows = [
      ['a', 'b,c'],
      ['d"e', 'f'],
    ]
    expect(parseCsv(toCsv(rows))).toEqual(rows)
  })
})

describe('sanitizeCsvValue', () => {
  it('prefixes formula triggers with a single quote', () => {
    expect(sanitizeCsvValue('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(sanitizeCsvValue('@user')).toBe("'@user")
    expect(sanitizeCsvValue('+123')).toBe("'+123")
    expect(sanitizeCsvValue('-123')).toBe("'-123")
  })

  it('leaves normal values untouched', () => {
    expect(sanitizeCsvValue('Acme')).toBe('Acme')
    expect(sanitizeCsvValue('a@b.co')).toBe('a@b.co')
  })
})
