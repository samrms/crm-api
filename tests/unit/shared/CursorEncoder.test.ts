import { describe, it, expect } from 'vitest'
import {
  encodeCursor,
  decodeCursor,
} from '../../../src/shared/pagination/CursorEncoder.ts'

process.env.SESSION_SECRET = 'test-secret-key-for-cursor-signing'

describe('CursorEncoder', () => {
  it('encodes and decodes cursor', () => {
    const data = { createdAt: '2024-01-15T10:30:00Z', id: 'co_abc123' }
    const encoded = encodeCursor(data)
    const decoded = decodeCursor(encoded)

    expect(decoded).toEqual(data)
  })

  it('returns null for tampered cursor', () => {
    const data = { createdAt: '2024-01-15T10:30:00Z', id: 'co_abc123' }
    const encoded = encodeCursor(data)
    const tampered = encoded.slice(0, -5) + 'XXXXX'

    const decoded = decodeCursor(tampered)
    expect(decoded).toBeNull()
  })

  it('returns null for invalid base64', () => {
    const decoded = decodeCursor('not-a-valid-cursor')
    expect(decoded).toBeNull()
  })

  it('returns null for empty string', () => {
    const decoded = decodeCursor('')
    expect(decoded).toBeNull()
  })

  it('returns null for cursor without signature', () => {
    const data = { createdAt: '2024-01-15T10:30:00Z', id: 'co_abc123' }
    const base64 = Buffer.from(JSON.stringify(data)).toString('base64url')
    const decoded = decodeCursor(base64)
    expect(decoded).toBeNull()
  })
})
