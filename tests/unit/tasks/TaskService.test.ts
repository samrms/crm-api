import { describe, it, expect, vi } from 'vitest'
import { createTaskService } from '../../../src/modules/tasks/application/TaskService.js'

describe('Unit: TaskService', () => {
  it('complete task', async () => {
    const svc = createTaskService({
      findById: vi.fn().mockResolvedValue({ id: 't1', status: 'PENDING' }),
      update: vi.fn().mockResolvedValue({ id: 't1', status: 'COMPLETED' }),
    } as any)
    const r = await svc.complete('t1', 'o1')
    expect(r.status).toBe('COMPLETED')
  })
})
