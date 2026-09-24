import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import cookie from '@fastify/cookie'
import { randomUUID } from 'node:crypto'
import { config } from './shared/config.js'
import { RequestIdPlugin } from './shared/http/requestId.js'
import { ErrorHandlerPlugin } from './shared/http/errorHandler.js'
import { HealthPlugin } from './shared/http/health.js'
import { OpenApiPlugin } from './shared/http/openapi.js'
import { Container } from './container.js'

export interface ApplicationOptions {
  rateLimit?: { max: number; timeWindow: string }
  storageDir?: string
}

export class Application {
  private readonly openApi = new OpenApiPlugin()
  private readonly requestId = new RequestIdPlugin()
  private readonly errorHandler = new ErrorHandlerPlugin()
  private readonly health = new HealthPlugin()

  constructor(private readonly options: ApplicationOptions = {}) {}

  async build(): Promise<FastifyInstance> {
    const app = Fastify({
      logger: {
        level: config.logLevel,
        transport: config.isProduction
          ? undefined
          : { target: 'pino-pretty', options: { colorize: true } },
      },
      trustProxy: true,
      genReqId: () => `req_${randomUUID()}`,
    })

    await app.register(helmet)
    await app.register(cors, {
      origin: config.corsOrigin,
      credentials: true,
    })

    const rateLimitOptions =
      this.options.rateLimit ??
      (config.nodeEnv === 'test' ? null : config.rateLimit)
    if (rateLimitOptions) await app.register(rateLimit, rateLimitOptions)

    await app.register(cookie)
    await this.openApi.register(app)

    app.setValidatorCompiler(() => (data: unknown) => ({ value: data }))

    await this.requestId.register(app)
    this.errorHandler.register(app)
    await this.health.register(app)

    const container = new Container({ storageDir: this.options.storageDir })
    await container.registerRoutes(app)

    return app
  }
}
