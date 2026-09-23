import { describe, it, expect, vi } from 'vitest'
import { TaskService } from '../../../src/modules/engagement/tasks/application/TaskService.js'
import type { TaskRepository } from '../../../src/modules/engagement/tasks/infrastructure/PostgresTaskRepository.js'

describe('Unit: TaskService', () => {
  it('complete task', async () => {
    const repo = {
      findById: vi.fn().mockResolvedValue({ id: 't1', status: 'PENDING' }),
      update: vi.fn().mockResolvedValue({ id: 't1', status: 'COMPLETED' }),
    } as TaskRepository
    const svc = new TaskService(repo)
    const r = await svc.update({
      taskId: 't1',
      organizationId: 'o1',
      status: 'COMPLETED',
    })
    expect(r.status).toBe('COMPLETED')
  })
})
