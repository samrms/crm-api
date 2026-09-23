import { nanoid } from 'nanoid'

type Prefix =
  | 'org'
  | 'user'
  | 'mem'
  | 'sess'
  | 'co'
  | 'ct'
  | 'ld'
  | 'dl'
  | 'task'
  | 'imp'
  | 'exp'
  | 'aud'
  | 'ob'
  | 'import'
  | 'act'

export function newId(prefix: Prefix): string {
  return `${prefix}_${nanoid(12)}`
}

export function isValidId(id: string, prefix?: Prefix): boolean {
  if (prefix)
    return id.startsWith(`${prefix}_`) && id.length > prefix.length + 1
  return /^[a-z]+_[A-Za-z0-9_-]+$/.test(id)
}
