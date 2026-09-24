import type { Kysely } from 'kysely'
import type { Database, OutboxEventsTable } from '@/shared/database/types.js'
import type { JobData, JobName, JobProducer } from './queue.js'
import { logger } from '@/shared/logging/logger.js'

export type DbProvider = () => Kysely<Database>

interface OutboxRoute {
  name: JobName
  toJobData: (event: OutboxEventsTable) => JobData
}

const ROUTES: Record<string, OutboxRoute> = {
  IMPORT_CREATED: {
    name: 'process-import',
    toJobData: (event) => {
      const payload = readPayload(event)
      return {
        organizationId: event.organization_id,
        importId: String(payload.importId ?? ''),
        type: String(payload.type ?? ''),
        filePath: String(payload.filePath ?? ''),
      }
    },
  },
  EXPORT_CREATED: {
    name: 'process-export',
    toJobData: (event) => {
      const payload = readPayload(event)
      return {
        organizationId: event.organization_id,
        exportId: String(payload.exportId ?? ''),
        type: String(payload.type ?? ''),
      }
    },
  },
}

function readPayload(event: OutboxEventsTable): Record<string, unknown> {
  const payload = event.payload as unknown
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  if (payload && typeof payload === 'object') {
    return payload as Record<string, unknown>
  }
  return {}
}

export interface OutboxRelayOptions {
  
  intervalMs?: number
  
  batchSize?: number
}

export class OutboxRelay {
  private timer: ReturnType<typeof setInterval> | null = null
  private ticking = false
  private readonly intervalMs: number
  private readonly batchSize: number

  constructor(
    private readonly db: DbProvider,
    private readonly producer: JobProducer,
    options: OutboxRelayOptions = {},
  ) {
    this.intervalMs = options.intervalMs ?? 1_000
    this.batchSize = options.batchSize ?? 50
  }

  async dispatchOnce(): Promise<number> {
    const events = await this.db()
      .selectFrom('outbox_events')
      .selectAll()
      .where('processed_at', 'is', null)
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
      .limit(this.batchSize)
      .execute()

    let dispatched = 0

    for (const event of events) {
      const row = event as OutboxEventsTable
      const route = ROUTES[row.type]

      if (!route) {
        logger.debug(
          { outboxId: row.id, type: row.type },
          'Outbox event has no queue route; acknowledging it',
        )
        await this.acknowledge(row.id)
        continue
      }

      await this.producer.add(route.name, route.toJobData(row), {
        jobId: `outbox_${row.id}`,
      })
      await this.acknowledge(row.id)
      dispatched += 1
    }

    return dispatched
  }
  
  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.tick()
    }, this.intervalMs)
    this.timer.unref?.()
    logger.info({ intervalMs: this.intervalMs }, 'Outbox relay started')
  }
  
  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    while (this.ticking) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    logger.info('Outbox relay stopped')
  }

  private async tick(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try {
      await this.dispatchOnce()
    } catch (error) {
      logger.error({ err: error }, 'Outbox relay tick failed')
    } finally {
      this.ticking = false
    }
  }

  private async acknowledge(eventId: string): Promise<void> {
    await this.db()
      .updateTable('outbox_events')
      .set({ processed_at: new Date() })
      .where('id', '=', eventId)
      .where('processed_at', 'is', null)
      .execute()
  }
}
