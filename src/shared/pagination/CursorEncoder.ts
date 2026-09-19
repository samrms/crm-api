import { config } from '../config.js'

interface CursorData {
  createdAt: string
  id: string
}

export function encodeCursor(data: CursorData): string {
  const json = JSON.stringify(data)
  const base64 = Buffer.from(json).toString('base64url')
  // Simple HMAC-like signature using config secret
  const signature = Buffer.from(`${base64}:${config.sessionSecret}`)
    .toString('base64url')
    .slice(0, 16)
  return `${base64}.${signature}`
}

export function decodeCursor(cursor: string): CursorData | null {
  try {
    const [base64, signature] = cursor.split('.')
    if (!base64 || !signature) return null

    // Verify signature
    const expectedSig = Buffer.from(`${base64}:${config.sessionSecret}`)
      .toString('base64url')
      .slice(0, 16)
    if (signature !== expectedSig) return null

    const json = Buffer.from(base64, 'base64url').toString()
    const data = JSON.parse(json) as CursorData

    if (!data.createdAt || !data.id) return null

    return data
  } catch {
    return null
  }
}
