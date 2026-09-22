import type { Kysely } from 'kysely'
import type { TasksTable, Database } from '@/shared/database/types.js'

export type TaskRow = TasksTable

export interface TaskRepository {
  findById(id: string, organizationId: string): Promise<TaskRow | undefined>
  list(
    organizationId: string,
    opts: { limit: number; after?: string; status?: string },
  ): Promise<TaskRow[]>
  create(data: {
    id: string
    organizationId: string
    title: string
    description?: string
    dealId?: string
    leadId?: string
    contactId?: string
    assignedToId?: string
    dueDate?: Date
  }): Promise<TaskRow>
  update(
    id: string,
    organizationId: string,
    data: {
      title?: string
      description?: string
      status?: TaskRow['status']
      dealId?: string
      leadId?: string
      contactId?: string
      assignedToId?: string
      dueDate?: Date
    },
  ): Promise<TaskRow | undefined>
  softDelete(id: string, organizationId: string): Promise<boolean>
}

export class PostgresTaskRepository implements TaskRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(
    id: string,
    organizationId: string,
  ): Promise<TaskRow | undefined> {
    const row = await this.db
      .selectFrom('tasks')
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return row as TaskRow | undefined
  }

  async list(
    organizationId: string,
    opts: { limit: number; after?: string; status?: string },
  ): Promise<TaskRow[]> {
    let query = this.db
      .selectFrom('tasks')
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)

    if (opts.status) {
      query = query.where('status', '=', opts.status as TaskRow['status'])
    }

    query = query
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(opts.limit + 1)

    if (opts.after) {
      const decoded = JSON.parse(
        Buffer.from(opts.after, 'base64url').toString(),
      )
      query = query.where((eb) =>
        eb.or([
          eb('created_at', '<', new Date(decoded.createdAt)),
          eb('created_at', '=', new Date(decoded.createdAt)),
        ]),
      )
    }

    const rows = await query.execute()
    return rows as TaskRow[]
  }

  async create(data: {
    id: string
    organizationId: string
    title: string
    description?: string
    dealId?: string
    leadId?: string
    contactId?: string
    assignedToId?: string
    dueDate?: Date
  }): Promise<TaskRow> {
    const now = new Date()
    const row = await this.db
      .insertInto('tasks')
      .values({
        id: data.id,
        organization_id: data.organizationId,
        title: data.title,
        description: data.description ?? null,
        dealId: data.dealId ?? null,
        leadId: data.leadId ?? null,
        contactId: data.contactId ?? null,
        assignedToId: data.assignedToId ?? null,
        dueDate: data.dueDate ?? null,
        status: 'PENDING',
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    return row as TaskRow
  }

  async update(
    id: string,
    organizationId: string,
    data: {
      title?: string
      description?: string
      status?: TaskRow['status']
      dealId?: string
      leadId?: string
      contactId?: string
      assignedToId?: string
      dueDate?: Date
    },
  ): Promise<TaskRow | undefined> {
    const row = await this.db
      .updateTable('tasks')
      .set({ ...data, updated_at: new Date() })
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst()
    return row as TaskRow | undefined
  }

  async softDelete(id: string, organizationId: string): Promise<boolean> {
    const row = await this.db
      .updateTable('tasks')
      .set({ deleted_at: new Date(), updated_at: new Date() })
      .where('id', '=', id)
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst()
    return !!row
  }
}
