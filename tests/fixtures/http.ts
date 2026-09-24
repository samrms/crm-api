export function extractSessionToken(res: {
  headers: Record<string, string | string[] | undefined>
}): string {
  const raw = res.headers['set-cookie']
  const header = Array.isArray(raw) ? raw.join('; ') : raw
  const match = header?.match(/(?:^|;\s*)session=([^;]+)/)
  if (!match?.[1]) {
    throw new Error('Response did not set a session cookie')
  }
  return match[1]
}
