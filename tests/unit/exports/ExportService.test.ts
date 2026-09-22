import { describe, it, expect, vi } from 'vitest'
import { createExportService } from '../../../src/modules/exports/application/ExportService.js'

describe('Unit: ExportService', () => {
  it('create export', async () => {
    const svc = createExportService({
      create: vi.fn().mockResolvedValue({ id: 'exp1', status: 'PENDING' }),
    } as any)
    const r = await svc.create({
      organizationId: 'o1',
      actorId: 'u1',
      type: 'DEALS',
    })
    expect(r.status).toBe('PENDING')
  })
})
