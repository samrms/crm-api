import { describe, it, expect, vi } from 'vitest'
import { ImportService } from '../../../src/modules/bulk/imports/application/ImportService.js'
import type { ImportRepository } from '../../../src/modules/bulk/imports/infrastructure/PostgresImportRepository.js'
import { NotFoundError } from '../../../src/shared/errors/AppError.js'

const repo = (overrides: Partial<ImportRepository> = {}) =>
  ({
    findById: vi.fn().mockResolvedValue({ id: 'imp1', status: 'PENDING' }),
    create: vi
      .fn()
      .mockImplementation((data) => ({ ...data, status: 'PENDING' })),
    updateProgress: vi.fn(),
    updateStatus: vi.fn(),
    ...overrides,
  }) as unknown as ImportRepository

describe('ImportService', () => {
  const input = {
    organizationId: 'o1',
    actorId: 'u1',
    type: 'companies',
    filePath: '/tmp/import.csv',
  }

  it('createImport delegates to the repository with a generated id', async () => {
    const repository = repo()
    const created = await new ImportService(repository).createImport(input)

    expect(created.id).toMatch(/^imp_/)
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ ...input, id: created.id }),
    )
  })

  it('getImport returns the import', async () => {
    const repository = repo()
    const imp = await new ImportService(repository).getImport('imp1', 'o1')

    expect(imp.id).toBe('imp1')
    expect(repository.findById).toHaveBeenCalledWith('imp1', 'o1')
  })

  it('getImport throws NotFoundError for an unknown import', async () => {
    const service = new ImportService(
      repo({ findById: vi.fn().mockResolvedValue(undefined) }),
    )
    await expect(service.getImport('missing', 'o1')).rejects.toThrow(
      NotFoundError,
    )
  })
})
