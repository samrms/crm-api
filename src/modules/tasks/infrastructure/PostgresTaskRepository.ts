import { getDb } from '../../../shared/database/connection.js'
import type { TasksTable } from '../../../shared/database/types.js'

export type TaskRow = TasksTable

export interface TaskRepository {
  findById(id: string, organizationId: string): Promise<TaskRow | undefined>
  create(data: {
    id: string
    organizationId: string
    title: string
    description?: string
    dueDate?: Date
    dealId?: string
    leadId?: string
    assignedToId?: string
  }): Promise<TaskRow>
  complete(id: string, organizationId: string): Promise<TaskRow | undefined>
}

export class PostgresTaskRepository implements TaskRepository {
  async findById(
    id: string,
    organizationId: string,
  ): Promise<TaskRow | undefined> {
    const row = await getDb()
      .selectFrom('tasks')
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return row as TaskRow | undefined
  }

  async create(data: {
    id: string
    organizationId: string
    title: string
    description?: string
    dueDate?: Date
    dealId?: string
    leadId?: string
    assignedToId?: string
  }): Promise<TaskRow> {
    const now = new Date()
    const row = await getDb()
      .insertInto('tasks')
      .values({
        id: data.id,
        organization_id: data.organizationId,
        title: data.title,
        description: data.description ?? null,
        dueDate: data.dueDate ?? null,
        dealId: data.dealId ?? null,
        leadId: data.leadId ?? null,
        assignedToId: data.assignedToId ?? null,
        status: 'PENDING',
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    return row as TaskRow
  }

  async complete(
    id: string,
    organizationId: string,
  ): Promise<TaskRow | undefined> {
    const row = await getDb()
      .updateTable('tasks')
      .set({ status: 'COMPLETED', updated_at: new Date() })
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst()
    return row as TaskRow | undefined
  }
}
