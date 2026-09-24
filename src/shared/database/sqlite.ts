import { createRequire } from 'node:module'
import type { SqliteDatabase, SqliteStatement } from 'kysely'

export function isSqliteUrl(url: string): boolean {
  return (
    url.startsWith('sqlite:') ||
    url.includes(':memory:') ||
    url.includes('.db') ||
    url.includes('.sqlite')
  )
}

export function sqlitePathFromUrl(url: string): string {
  const path = url
    .replace(/^sqlite:/i, '')
    .replace(/^\/\//, '')
    .replace(/^file:/i, '')
  if (!path || path.includes(':memory:')) return ':memory:'
  return path
}

interface RawStatement {
  all(...params: unknown[]): unknown[]
  get(...params: unknown[]): unknown
  run(...params: unknown[]): unknown
  iterate(...params: unknown[]): IterableIterator<unknown>
}

interface RawDatabase {
  prepare(sql: string): RawStatement
  exec(sql: string): void
  close(): void
}

function loadRawDatabase(path: string): RawDatabase {
  const req = createRequire(import.meta.url)
  try {
    const { DatabaseSync } = req('node:sqlite') as {
      DatabaseSync: new (path: string) => RawDatabase
    }
    return new DatabaseSync(path)
  } catch {
    const { Database } = req('bun:sqlite') as {
      Database: new (path: string) => RawDatabase
    }
    return new Database(path)
  }
}

function toSqliteParam(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'boolean') return v ? 1 : 0
  if (
    v !== null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    !(v instanceof Uint8Array)
  ) {
    return JSON.stringify(v)
  }
  return v
}

const DATE_LIKE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/

function reviveDates<T>(row: T): T {
  if (row && typeof row === 'object') {
    const record = row as Record<string, unknown>
    for (const key of Object.keys(record)) {
      const value = record[key]
      if (typeof value === 'string' && DATE_LIKE.test(value)) {
        record[key] = new Date(value)
      }
    }
  }
  return row
}

function normalizeParams(params: unknown[]): unknown[] {
  const flat =
    params.length === 1 && Array.isArray(params[0])
      ? (params[0] as unknown[])
      : params
  return flat.map(toSqliteParam)
}

export function openSqliteDatabase(url: string): SqliteDatabase {
  const sqlite = loadRawDatabase(sqlitePathFromUrl(url))
  return {
    prepare(sql: string): SqliteStatement {
      const reader =
        /^\s*select/i.test(sql) || sql.toLowerCase().includes('returning')
      const stmt = sqlite.prepare(sql)
      return {
        reader,
        run: (parameters) => {
          const result = stmt.run(...normalizeParams([parameters]))
          const record = result as {
            changes?: number | bigint
            lastInsertRowid?: number | bigint
          }
          return {
            changes: record.changes ?? 0,
            lastInsertRowid: record.lastInsertRowid ?? 0,
          }
        },
        all: (parameters: ReadonlyArray<unknown>) =>
          stmt
            .all(...normalizeParams([parameters]))
            .map((row) => reviveDates(row)),
        iterate: (parameters) =>
          stmt
            .all(...normalizeParams([parameters]))
            .map((row) => reviveDates(row))
            .values(),
      }
    },
    close: () => sqlite.close(),
  }
}
