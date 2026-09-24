import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import cookie from '@fastify/cookie'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { randomUUID } from 'node:crypto'
import { config } from './shared/config.js'
import { requestIdPlugin } from './shared/http/requestId.js'
import { errorHandlerPlugin } from './shared/http/errorHandler.js'
import { healthPlugin } from './shared/http/health.js'
import { buildContainer } from './container.js'

export interface BuildAppOptions {
  rateLimit?: { max: number; timeWindow: string }
  storageDir?: string
}

export async function buildApp(options: BuildAppOptions = {}) {
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
  await app.register(cors, { origin: config.corsOrigin, credentials: true })
  const rateLimitOptions =
    options.rateLimit ?? (config.nodeEnv === 'test' ? null : config.rateLimit)
  if (rateLimitOptions) await app.register(rateLimit, rateLimitOptions)
  await app.register(cookie)
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Essential CRM API',
        version: '0.1.0',
        description: 'Minimal CRM REST API.',
      },
      tags: [
        { name: 'Auth', description: 'Authentication' },
        { name: 'Organizations', description: 'Organization management' },
        { name: 'Companies', description: 'Customers' },
        { name: 'Contacts', description: 'Contact people' },
        { name: 'Leads', description: 'Lead pipeline' },
        { name: 'Deals', description: 'Sales deals' },
        { name: 'Tasks', description: 'Engagement tasks' },
        { name: 'Bulk', description: 'Import/export' },
      ],
      components: {
        securitySchemes: {
          sessionCookie: {
            type: 'apiKey',
            in: 'cookie',
            name: 'session',
            description: 'Session cookie',
          },
        },
      },
    },
  })
  await app.register(swaggerUi, { routePrefix: '/docs' })
  app.setValidatorCompiler(() => (data: unknown) => ({ value: data }))
  app.addHook('onSend', async (request, reply) => {
    if (request.url.startsWith('/docs')) {
      reply.removeHeader('content-security-policy')
      reply.removeHeader('cross-origin-embedder-policy')
    }
  })
  await requestIdPlugin(app)
  await errorHandlerPlugin(app)
  await healthPlugin(app)
  const { registerRoutes } = buildContainer({ storageDir: options.storageDir })
  await registerRoutes(app)
  return app
}
