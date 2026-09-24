import { Application, type ApplicationOptions } from './app.js'
import { config } from './shared/config.js'
import { database } from './shared/database/connection.js'
import { DatabaseMigrator } from './shared/database/migrate.js'
import { logger } from './shared/logging/logger.js'
import type { FastifyInstance } from 'fastify'

export class Server {
  private app: FastifyInstance | null = null
  private shuttingDown = false

  constructor(private readonly options: ApplicationOptions = {}) {}

  async start(): Promise<void> {
    await new DatabaseMigrator().up()

    this.app = await new Application(this.options).build()

    try {
      await this.app.listen({ port: config.port, host: config.host })
      logger.info(
        { port: config.port, host: config.host },
        'CRM API server started',
      )
    } catch (err) {
      logger.error({ err }, 'Failed to start server')
      process.exit(1)
    }

    process.on('SIGTERM', () => this.shutdown('SIGTERM'))
    process.on('SIGINT', () => this.shutdown('SIGINT'))
  }

  private async shutdown(signal: string): Promise<void> {
    if (this.shuttingDown) return
    this.shuttingDown = true
    logger.info({ signal }, 'Shutting down...')
    if (this.app) await this.app.close()
    await database.close()
    process.exit(0)
  }
}

void new Server().start()
