import { describe, it, expect, vi } from 'vitest'
import { ExportService } from '../../../src/modules/bulk/exports/application/ExportService.js'
import type { ExportRepository } from '../../../src/modules/bulk/exports/infrastructure/PostgresExportRepository.js'
import type { Kysely, Database } from '../../../src/shared/database/types.js'
import { NotFoundError } from '../../../src/shared/errors/AppError.js'

describe('Unit: ExportService', () => {
  const db = {} as unknown as Kysely<Database>

  it('getExport returns the export', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue({ id: 'exp1', status: 'PENDING' }),
      create: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as ExportRepository

    const svc = new ExportService(db, repo)
    const exp = await svc.getExport('exp1', 'o1')

    expect(exp.id).toBe('exp1')
    expect(repo.findById).toHaveBeenCalledWith('exp1', 'o1')
  })

  it('getExport throws NotFoundError for an unknown export', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as ExportRepository

    const svc = new ExportService(db, repo)

    await expect(svc.getExport('missing', 'o1')).rejects.toThrow(NotFoundError)
  })
})
