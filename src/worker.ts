import { Worker, type Job } from 'bullmq'
import { Redis } from 'ioredis'
import { config } from './shared/config.js'
import { logger } from './shared/logging/logger.js'
import { getDb, closeDatabase } from './shared/database/connection.js'
import { PostgresImportRepository } from './modules/imports/infrastructure/PostgresImportRepository.js'
import { PostgresExportRepository } from './modules/exports/infrastructure/PostgresExportRepository.js'

const connection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
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

  const db = getDb()
  const repo = new PostgresImportRepository(db)

  const existing = await repo.findById(importId, organizationId)
  if (existing && existing.status === 'COMPLETED') {
    logger.info({ importId }, 'Import already completed, skipping')
    return
  }

  await repo.updateStatus(importId, 'PROCESSING')

  try {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await repo.updateProgress(importId, {
      processed: 0,
      successful: 0,
      failed: 0,
    })
    await repo.updateStatus(importId, 'COMPLETED')
    logger.info({ importId }, 'Import completed')
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await repo.updateStatus(importId, 'FAILED', msg)
    throw error
  }
}

async function processExportJob(job: Job<ExportJobData>): Promise<void> {
  const { exportId, organizationId, type } = job.data
  logger.info({ exportId, organizationId, type }, 'Processing export')

  const db = getDb()
  const repo = new PostgresExportRepository(db)

  await repo.updateStatus(exportId, 'PROCESSING')

  try {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await repo.updateStatus(exportId, 'COMPLETED', {
      filePath: `/storage/exports/${exportId}.csv`,
    })
    logger.info({ exportId }, 'Export completed')
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await repo.updateStatus(exportId, 'FAILED', { errorMessage: msg })
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
