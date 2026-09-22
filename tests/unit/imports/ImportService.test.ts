import { describe, it, expect, vi } from 'vitest'
import { createImportService } from '../../../src/modules/imports/application/ImportService.js'

describe('Unit: ImportService', () => {
  it('create import', async () => {
    const svc = createImportService({
      create: vi.fn().mockResolvedValue({ id: 'imp1', status: 'PENDING' }),
    } as any)
    const r = await svc.create({
      organizationId: 'o1',
      actorId: 'u1',
      type: 'COMPANIES',
    })
    expect(r.status).toBe('PENDING')
  })
})
