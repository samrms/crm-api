import { newId } from '@/shared/utils/id.js'
import type { TaskRepository } from '@/modules/engagement/tasks/infrastructure/PostgresTaskRepository.js'
import { NotFoundError } from '@/shared/errors/AppError.js'

export interface CreateTaskInput {
  organizationId: string
  title: string
  description?: string
  dealId?: string
  leadId?: string
  contactId?: string
  assignedToId?: string
  dueDate?: Date
}

export interface UpdateTaskInput {
  organizationId: string
  taskId: string
  title?: string
  description?: string
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  dealId?: string
  leadId?: string
  contactId?: string
  assignedToId?: string
  dueDate?: Date
}

export class TaskService {
  constructor(private readonly repo: TaskRepository) {}
  async create(input: CreateTaskInput) {
    const id = newId('task')
    return this.repo.create({
      id,
      organizationId: input.organizationId,
      title: input.title,
      description: input.description,
      dealId: input.dealId,
      leadId: input.leadId,
      contactId: input.contactId,
      assignedToId: input.assignedToId,
      dueDate: input.dueDate,
    })
  }

  async update(input: UpdateTaskInput) {
    const result = await this.repo.update(input.taskId, input.organizationId, {
      title: input.title,
      description: input.description,
      status: input.status,
      dealId: input.dealId,
      leadId: input.leadId,
      contactId: input.contactId,
      assignedToId: input.assignedToId,
      dueDate: input.dueDate,
    })
    if (!result) {
      throw new NotFoundError('Task', input.taskId)
    }
    return result
  }

  async get(id: string, organizationId: string) {
    const task = await this.repo.findById(id, organizationId)
    if (!task) {
      throw new NotFoundError('Task', id)
    }
    return task
  }

  async list(
    organizationId: string,
    opts: { limit: number; after?: string; status?: string },
  ) {
    return this.repo.list(organizationId, opts)
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const deleted = await this.repo.softDelete(id, organizationId)
    if (!deleted) {
      throw new NotFoundError('Task', id)
    }
  }

  async complete(taskId: string, organizationId: string) {
    const result = await this.repo.update(taskId, organizationId, {
      status: 'COMPLETED',
    })
    if (!result) {
      throw new NotFoundError('Task', taskId)
    }
    return result
  }
}

export function createTaskService(repo: TaskRepository): TaskService {
  return new TaskService(repo)
}
