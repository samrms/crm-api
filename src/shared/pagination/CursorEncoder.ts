import { createHmac } from 'node:crypto'
import { config } from '@/shared/config.js'
import { AppError } from '@/shared/errors/AppError.js'

interface CursorData {
  createdAt: string
  id: string
}

function sign(data: string): string {
  return createHmac('sha256', config.sessionSecret)
    .update(data)
    .digest('base64url')
    .slice(0, 16)
}

export function encodeCursor(data: CursorData): string {
  const json = JSON.stringify(data)
  const base64 = Buffer.from(json).toString('base64url')
  const signature = sign(base64)
  return `${base64}.${signature}`
}

export function decodeCursor(cursor: string): CursorData | null {
  try {
    const [base64, signature] = cursor.split('.')
    if (!base64 || !signature) return null

    const expectedSig = sign(base64)
    if (signature !== expectedSig) return null

    const json = Buffer.from(base64, 'base64url').toString()
    const data = JSON.parse(json) as CursorData

    if (!data.createdAt || !data.id) return null

    return data
  } catch {
    return null
  }
}

export function verifyCursor(cursor: string): CursorData {
  const data = decodeCursor(cursor)
  if (!data) {
    throw new AppError({
      statusCode: 400,
      code: 'INVALID_CURSOR',
      message: 'Invalid or tampered pagination cursor',
    })
  }
  return data
}
