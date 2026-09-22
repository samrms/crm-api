import { buildApp } from './app.js'
import { config } from './shared/config.js'
import { closeDatabase } from './shared/database/connection.js'
import { migrateUp } from './shared/database/migrate.js'
import { logger } from './shared/logging/logger.js'

async function start() {
  await migrateUp()

  const app = await buildApp()

  try {
    await app.listen({ port: config.port, host: config.host })
    logger.info(
      { port: config.port, host: config.host },
      'CRM API server started',
    )
  } catch (err) {
    logger.error({ err }, 'Failed to start server')
    process.exit(1)
  }

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...')
    await app.close()
    await closeDatabase()
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

start()
