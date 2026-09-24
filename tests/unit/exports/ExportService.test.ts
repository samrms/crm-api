import { describe, it, expect, vi } from 'vitest'
import { ExportService } from '../../../src/modules/bulk/exports/application/ExportService.js'
import type { ExportRepository } from '../../../src/modules/bulk/exports/infrastructure/PostgresExportRepository.js'
import { NotFoundError } from '../../../src/shared/errors/AppError.js'

const repo = (overrides: Partial<ExportRepository> = {}) =>
  ({
    findById: vi.fn().mockResolvedValue({ id: 'exp1', status: 'PENDING' }),
    create: vi
      .fn()
      .mockImplementation((data) => ({ ...data, status: 'PENDING' })),
    updateStatus: vi.fn(),
    ...overrides,
  }) as unknown as ExportRepository

describe('ExportService', () => {
  const input = { organizationId: 'o1', actorId: 'u1', type: 'companies' }

  it('createExport delegates to the repository with a generated id', async () => {
    const repository = repo()
    const created = await new ExportService(repository).createExport(input)

    expect(created.id).toMatch(/^exp_/)
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ ...input, id: created.id }),
    )
  })

  it('getExport returns the export', async () => {
    const repository = repo()
    const exp = await new ExportService(repository).getExport('exp1', 'o1')

    expect(exp.id).toBe('exp1')
    expect(repository.findById).toHaveBeenCalledWith('exp1', 'o1')
  })

  it('getExport throws NotFoundError for an unknown export', async () => {
    const service = new ExportService(
      repo({ findById: vi.fn().mockResolvedValue(undefined) }),
    )
    await expect(service.getExport('missing', 'o1')).rejects.toThrow(
      NotFoundError,
    )
  })
})
