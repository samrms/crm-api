import { describe, it, expect, vi } from 'vitest'
import { ImportService } from '../../../src/modules/imports/application/ImportService.js'
import type { ImportRepository } from '../../../src/modules/imports/infrastructure/PostgresImportRepository.js'
import type { Kysely, Database } from '../../../src/shared/database/types.js'

describe('Unit: ImportService', () => {
  it('create import', async () => {
    const repo = {
      create: vi.fn().mockResolvedValue({ id: 'imp1', status: 'PENDING' }),
      findById: vi.fn(),
      updateProgress: vi.fn(),
      updateStatus: vi.fn(),
    } as ImportRepository
    const db = {
      transaction: () => ({
        execute: async (fn: (...args: unknown[]) => unknown) =>
          await fn({
            insertInto: () => ({ values: () => ({ execute: async () => {} }) }),
          }),
      }),
    } as unknown as Kysely<Database>
    const svc = new ImportService(db, repo)
    const r = await svc.createImport({
      organizationId: 'o1',
      actorId: 'u1',
      type: 'COMPANIES',
      filePath: '/tmp/x',
    })
    expect(r.status).toBe('PENDING')
  })
})
