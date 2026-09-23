import { describe, it, expect, vi } from 'vitest'
import { ImportService } from '../../../src/modules/bulk/imports/application/ImportService.js'
import type { ImportRepository } from '../../../src/modules/bulk/imports/infrastructure/PostgresImportRepository.js'
import type { Kysely, Database } from '../../../src/shared/database/types.js'
import { NotFoundError } from '../../../src/shared/errors/AppError.js'

describe('Unit: ImportService', () => {
  const db = {} as unknown as Kysely<Database>

  it('getImport returns the import', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue({ id: 'imp1', status: 'PENDING' }),
      create: vi.fn(),
      updateProgress: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as ImportRepository

    const svc = new ImportService(db, repo)
    const imp = await svc.getImport('imp1', 'o1')

    expect(imp.id).toBe('imp1')
    expect(repo.findById).toHaveBeenCalledWith('imp1', 'o1')
  })

  it('getImport throws NotFoundError for an unknown import', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
      updateProgress: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as ImportRepository

    const svc = new ImportService(db, repo)

    await expect(svc.getImport('missing', 'o1')).rejects.toThrow(NotFoundError)
  })
})
