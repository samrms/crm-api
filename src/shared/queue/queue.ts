import { Queue } from 'bullmq'
import { redisClient } from '@/shared/cache/redis.js'

export const QUEUE_NAME = 'crm-jobs'

export type JobName = 'process-import' | 'process-export'

export interface JobData {
  organizationId: string
  [key: string]: unknown
}

export interface JobProducer {
  add(name: JobName, data: JobData, opts?: { jobId?: string }): Promise<void>
}

export class JobQueue implements JobProducer {
  private queue: Queue<JobData> | null = null

  get instance(): Queue<JobData> {
    if (!this.queue) {
      this.queue = new Queue<JobData>(QUEUE_NAME, {
        connection: redisClient.instance({
          maxRetriesPerRequest: null,
          lazyConnect: false,
        }),
      })
    }
    return this.queue
  }

  async add(
    name: JobName,
    data: JobData,
    opts?: { jobId?: string },
  ): Promise<void> {
    await this.instance.add(name, data, {
      jobId: opts?.jobId,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: { count: 1_000 },
      removeOnFail: { count: 5_000 },
    })
  }

  async close(): Promise<void> {
    if (this.queue) {
      await this.queue.close()
      this.queue = null
    }
  }
}

export const jobQueue = new JobQueue()
