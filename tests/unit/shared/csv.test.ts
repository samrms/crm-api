import { describe, it, expect } from 'vitest'
import {
  parseCsv,
  parseCsvTable,
  toCsv,
  toCsvCell,
} from '../../../src/shared/utils/csv.js'

describe('Unit: CSV', () => {
  describe('parseCsv', () => {
    it('parses simple rows and trims line endings', () => {
      expect(parseCsv('a,b\n1,2\n3,4')).toEqual([
        ['a', 'b'],
        ['1', '2'],
        ['3', '4'],
      ])
    })

    it('handles CRLF line endings', () => {
      expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
        ['a', 'b'],
        ['1', '2'],
      ])
    })

    it('does not emit a phantom row for a trailing newline', () => {
      expect(parseCsv('a\n')).toEqual([['a']])
      expect(parseCsv('')).toEqual([])
    })

    it('keeps quoted commas, newlines and escaped quotes', () => {
      const csv = 'name,notes\n"Doe, Jane","She said ""hi""\nbye"'
      expect(parseCsv(csv)).toEqual([
        ['name', 'notes'],
        ['Doe, Jane', 'She said "hi"\nbye'],
      ])
    })

    it('strips a UTF-8 BOM from the first header', () => {
      expect(parseCsv('\uFEFFname\nAcme')).toEqual([['name'], ['Acme']])
    })

    it('keeps a literal quote that is not at the start of a field', () => {
      expect(parseCsv('inch\n5"')).toEqual([['inch'], ['5"']])
    })
  })

  describe('parseCsvTable', () => {
    it('keys cells by header column and fills short rows', () => {
      const { header, records } = parseCsvTable('name,size\nAcme,large\nBeta')
      expect(header).toEqual(['name', 'size'])
      expect(records).toEqual([
        { name: 'Acme', size: 'large' },
        { name: 'Beta', size: '' },
      ])
    })

    it('skips blank lines between records', () => {
      const { records } = parseCsvTable('name\nAcme\n\nBeta\n')
      expect(records).toHaveLength(2)
    })

    it('returns an empty table for empty input', () => {
      expect(parseCsvTable('')).toEqual({ header: [], records: [] })
    })
  })

  describe('toCsvCell', () => {
    it('quotes only when the value requires it', () => {
      expect(toCsvCell('plain')).toBe('plain')
      expect(toCsvCell('a,b')).toBe('"a,b"')
      expect(toCsvCell('say "hi"')).toBe('"say ""hi"""')
      expect(toCsvCell('line\nbreak')).toBe('"line\nbreak"')
    })

    it('renders null, undefined and dates predictably', () => {
      expect(toCsvCell(null)).toBe('')
      expect(toCsvCell(undefined)).toBe('')
      expect(toCsvCell(new Date('2026-01-02T03:04:05.000Z'))).toBe(
        '2026-01-02T03:04:05.000Z',
      )
    })
  })

  describe('toCsv', () => {
    it('emits a header, one line per row and a trailing newline', () => {
      expect(
        toCsv(
          ['id', 'name'],
          [
            ['1', 'Acme'],
            ['2', 'A, B'],
          ],
        ),
      ).toBe('id,name\n1,Acme\n2,"A, B"\n')
    })

    it('round-trips through parseCsv', () => {
      const header = ['id', 'name', 'notes']
      const rows = [['1', 'Doe, Jane', 'said "hi"\nbye']]
      expect(parseCsv(toCsv(header, rows))).toEqual([header, rows[0]])
    })
  })
})
