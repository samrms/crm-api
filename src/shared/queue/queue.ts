import { Queue } from 'bullmq'
import { getRedis } from '@/shared/cache/redis.js'

export const QUEUE_NAME = 'crm-jobs'

export type JobName = 'process-import' | 'process-export'

export interface JobData {
  organizationId: string
  [key: string]: unknown
}

export interface JobProducer {
  add(name: JobName, data: JobData, opts?: { jobId?: string }): Promise<void>
}

let queue: Queue<JobData> | null = null

export function getQueue(): Queue<JobData> {
  if (!queue) {
    queue = new Queue<JobData>(QUEUE_NAME, {
      connection: getRedis({ maxRetriesPerRequest: null, lazyConnect: false }),
    })
  }
  return queue
}


export const bullProducer: JobProducer = {
  async add(name, data, opts) {
    await getQueue().add(name, data, {
      jobId: opts?.jobId,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: { count: 1_000 },
      removeOnFail: { count: 5_000 },
    })
  },
}

export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close()
    queue = null
  }
}
