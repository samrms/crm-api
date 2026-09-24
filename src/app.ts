import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import cookie from '@fastify/cookie'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { randomUUID } from 'node:crypto'
import { config } from './shared/config.js'
import { ErrorHandlerPlugin } from './shared/http/errorHandler.js'
import { HealthPlugin } from './shared/http/health.js'
import { openapi } from './shared/http/openapi/index.js'
import { Container } from './container.js'

export interface ApplicationOptions {
  rateLimit?: { max: number; timeWindow: string }
  storageDir?: string
}

export class Application {
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

    await this.registerDocs(app)
    app.setValidatorCompiler(() => (data: unknown) => ({ value: data }))
    this.registerRequestId(app)
    this.errorHandler.register(app)
    await this.health.register(app)

    await new Container({ storageDir: this.options.storageDir }).registerRoutes(
      app,
    )
    return app
  }

  private async registerDocs(app: FastifyInstance): Promise<void> {
    await app.register(swagger, openapi)
    await app.register(swaggerUi, { routePrefix: '/docs' })
    app.addHook('onSend', async (request, reply) => {
      if (!request.url.startsWith('/docs')) return
      reply.removeHeader('content-security-policy')
      reply.removeHeader('cross-origin-embedder-policy')
    })
  }

  private registerRequestId(app: FastifyInstance): void {
    app.addHook('onRequest', async (request) => {
      const existing = request.headers['x-request-id']
      if (typeof existing === 'string') request.id = existing
    })
    app.addHook('onSend', async (request, reply) => {
      reply.header('X-Request-Id', request.id)
    })
  }
}
