import { describe, it, expect, vi } from 'vitest'
import { ExportService } from '../../../src/modules/exports/application/ExportService.js'
import type { ExportRepository } from '../../../src/modules/exports/infrastructure/PostgresExportRepository.js'
import type { Kysely, Database } from '../../../src/shared/database/types.js'

describe('Unit: ExportService', () => {
  it('create export', async () => {
    const repo = {
      create: vi.fn().mockResolvedValue({ id: 'exp1' }),
      findById: vi.fn(),
      updateStatus: vi.fn(),
    } as ExportRepository
    const db = {
      transaction: () => ({
        execute: async (fn: (...args: unknown[]) => unknown) =>
          await fn({
            insertInto: () => ({ values: () => ({ execute: async () => {} }) }),
          }),
      }),
    } as unknown as Kysely<Database>
    const svc = new ExportService(db, repo)
    const r = await svc.createExport({
      organizationId: 'o1',
      actorId: 'u1',
      type: 'DEALS',
    })
    expect(r.status).toBe('PENDING')
  })
})
