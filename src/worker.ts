import { Queue, Worker, type Job } from 'bullmq'
import { Redis } from 'ioredis'
import { config } from './shared/config.js'
import { logger } from './shared/logging/logger.js'
import { closeDatabase } from './shared/database/connection.js'

const connection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
})

export const crmQueue = new Queue('crm-jobs', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
})

interface ImportJobData {
  importId: string
  organizationId: string
  type: string
  filePath: string
}

interface ExportJobData {
  exportId: string
  organizationId: string
  type: string
}

const worker = new Worker(
  'crm-jobs',
  async (job: Job) => {
    logger.info({ jobId: job.id, type: job.name }, 'Processing job')
    switch (job.name) {
      case 'process-import':
        return processImportJob(job as Job<ImportJobData>)
      case 'process-export':
        return processExportJob(job as Job<ExportJobData>)
      default:
        throw new Error(`Unknown job type: ${job.name}`)
    }
  },
  {
    connection,
    concurrency: 5,
    limiter: { max: 10, duration: 1000 },
  },
)

async function processImportJob(job: Job<ImportJobData>): Promise<void> {
  const { importId, organizationId, type } = job.data
  logger.info({ importId, organizationId, type }, 'Processing import')

  const { getDb } = await import('./shared/database/connection.js')
  const existing = await getDb()
    .selectFrom('imports')
    .where('id', '=', importId)
    .executeTakeFirst()

  if (existing && (existing as { status: string }).status === 'COMPLETED') {
    logger.info({ importId }, 'Import already completed, skipping')
    return
  }

  await getDb()
    .updateTable('imports')
    .set({ status: 'PROCESSING', updated_at: new Date() })
    .where('id', '=', importId)
    .execute()

  try {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await getDb()
      .updateTable('imports')
      .set({
        status: 'COMPLETED',
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        updated_at: new Date(),
      })
      .where('id', '=', importId)
      .execute()
    logger.info({ importId }, 'Import completed')
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await getDb()
      .updateTable('imports')
      .set({ status: 'FAILED', error_message: msg, updated_at: new Date() })
      .where('id', '=', importId)
      .execute()
    throw error
  }
}

async function processExportJob(job: Job<ExportJobData>): Promise<void> {
  const { exportId, organizationId, type } = job.data
  logger.info({ exportId, organizationId, type }, 'Processing export')

  const { getDb } = await import('./shared/database/connection.js')
  await getDb()
    .updateTable('exports')
    .set({ status: 'PROCESSING', updated_at: new Date() })
    .where('id', '=', exportId)
    .execute()

  try {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await getDb()
      .updateTable('exports')
      .set({
        status: 'COMPLETED',
        file_path: `/storage/exports/${exportId}.csv`,
        updated_at: new Date(),
      })
      .where('id', '=', exportId)
      .execute()
    logger.info({ exportId }, 'Export completed')
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await getDb()
      .updateTable('exports')
      .set({ status: 'FAILED', error_message: msg, updated_at: new Date() })
      .where('id', '=', exportId)
      .execute()
    throw error
  }
}

worker.on('completed', (job) => {
  logger.info({ jobId: job.id, type: job.name }, 'Job completed')
})

worker.on('failed', (job, err) => {
  logger.error(
    { jobId: job?.id, type: job?.name, error: err.message },
    'Job failed',
  )
})

async function shutdown(signal: string) {
  logger.info({ signal }, 'Worker shutting down')
  await worker.close()
  await connection.quit()
  await closeDatabase()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
