import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import cookie from '@fastify/cookie'
import { config } from './shared/config.js'
import { requestIdPlugin } from './shared/http/requestId.js'
import { errorHandlerPlugin } from './shared/http/errorHandler.js'
import { healthPlugin } from './shared/http/health.js'
import { authRoutes } from './modules/users/http/authRoutes.js'
import { companyRoutes } from './modules/companies/http/companyRoutes.js'
import { contactRoutes } from './modules/contacts/http/contactRoutes.js'
import { leadRoutes } from './modules/leads/http/leadRoutes.js'
import { dealRoutes } from './modules/deals/http/dealRoutes.js'
import { taskRoutes } from './modules/tasks/http/taskRoutes.js'
import { importRoutes } from './modules/imports/http/importRoutes.js'
import { exportRoutes } from './modules/exports/http/exportRoutes.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport: config.isProduction
        ? undefined
        : { target: 'pino-pretty', options: { colorize: true } },
    },
    trustProxy: true,
    genReqId: () => `req_${Math.random().toString(36).slice(2, 14)}`,
  })

  await app.register(helmet)
  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  })
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })

  await app.register(cookie)
  await app.register(requestIdPlugin)
  await app.register(errorHandlerPlugin)
  await app.register(healthPlugin)

  const routes = [
    authRoutes,
    companyRoutes,
    contactRoutes,
    leadRoutes,
    dealRoutes,
    taskRoutes,
    importRoutes,
    exportRoutes,
  ]

  for (const route of routes) {
    await app.register(route)
  }

  return app
}
