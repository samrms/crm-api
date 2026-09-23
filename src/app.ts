import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import cookie from '@fastify/cookie'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { randomUUID } from 'node:crypto'
import { config } from './shared/config.js'
import { getDb } from './shared/database/connection.js'
import { requestIdPlugin } from './shared/http/requestId.js'
import { errorHandlerPlugin } from './shared/http/errorHandler.js'
import { healthPlugin } from './shared/http/health.js'

import { PostgresAuditRepository } from './modules/organizations/infrastructure/PostgresAuditRepository.js'
import { PostgresCompanyRepository } from './modules/crm/companies/infrastructure/PostgresCompanyRepository.js'
import { PostgresContactRepository } from './modules/crm/contacts/infrastructure/PostgresContactRepository.js'
import { PostgresDealRepository } from './modules/crm/deals/infrastructure/PostgresDealRepository.js'
import { PostgresExportRepository } from './modules/bulk/exports/infrastructure/PostgresExportRepository.js'
import { PostgresImportRepository } from './modules/bulk/imports/infrastructure/PostgresImportRepository.js'
import { PostgresLeadRepository } from './modules/crm/leads/infrastructure/PostgresLeadRepository.js'
import { PostgresMembershipRepository } from './modules/users/infrastructure/PostgresMembershipRepository.js'
import { PostgresOrganizationRepository } from './modules/organizations/infrastructure/PostgresOrganizationRepository.js'
import { PostgresTaskRepository } from './modules/engagement/tasks/infrastructure/PostgresTaskRepository.js'
import { PostgresUserRepository } from './modules/users/infrastructure/PostgresUserRepository.js'

import { AuditService } from './modules/organizations/application/AuditService.js'
import { CompanyService } from './modules/crm/companies/application/CompanyService.js'
import { ContactService } from './modules/crm/contacts/application/ContactService.js'
import { DealService } from './modules/crm/deals/application/DealService.js'
import { ExportService } from './modules/bulk/exports/application/ExportService.js'
import { ImportService } from './modules/bulk/imports/application/ImportService.js'
import { LeadService } from './modules/crm/leads/application/LeadService.js'
import { ConvertLead } from './modules/crm/leads/application/ConvertLead.js'
import { MemberService } from './modules/organizations/application/MemberService.js'
import { PostgresMemberRepository } from './modules/organizations/infrastructure/PostgresMemberRepository.js'
import { OrganizationService } from './modules/organizations/application/OrganizationService.js'
import { TaskService } from './modules/engagement/tasks/application/TaskService.js'
import { AuthService } from './modules/users/application/auth.js'
import { PostgresPasswordResetRepository } from './modules/users/infrastructure/PostgresPasswordResetRepository.js'

import { AuditRoutes } from './modules/organizations/http/auditRoutes.js'
import { AuthRoutes } from './modules/users/http/authRoutes.js'
import { CompanyRoutes } from './modules/crm/companies/http/companyRoutes.js'
import { ContactRoutes } from './modules/crm/contacts/http/contactRoutes.js'
import { DealRoutes } from './modules/crm/deals/http/dealRoutes.js'
import { ExportRoutes } from './modules/bulk/exports/http/exportRoutes.js'
import { ImportRoutes } from './modules/bulk/imports/http/importRoutes.js'
import { LeadRoutes } from './modules/crm/leads/http/leadRoutes.js'
import { MemberRoutes } from './modules/organizations/http/memberRoutes.js'
import { OrganizationRoutes } from './modules/organizations/http/organizationRoutes.js'
import { TaskRoutes } from './modules/engagement/tasks/http/taskRoutes.js'

export interface BuildAppOptions {
  rateLimit?: { max: number; timeWindow: string }
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
  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  })
  const rateLimitOptions =
    options.rateLimit ?? (config.nodeEnv === 'test' ? null : config.rateLimit)
  if (rateLimitOptions) {
    await app.register(rateLimit, rateLimitOptions)
  }

  await app.register(cookie)

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'CRM API',
        description:
          'Multi-tenant CRM REST API. Authentication is a session cookie; request schemas mirror the Zod validators.',
        version: '0.1.0',
      },
      components: {
        securitySchemes: {
          sessionCookie: { type: 'apiKey', in: 'cookie', name: 'session' },
        },
      },
    },
  })
  await app.register(swaggerUi, { routePrefix: '/docs' })

  // Route `schema` options below feed the OpenAPI document only.
  // Runtime validation stays in Zod (single source of truth, 422 contract).
  app.setValidatorCompiler(() => (data: unknown) => ({ value: data }))

  // Swagger UI needs inline scripts; lift helmet headers for /docs only.
  app.addHook('onSend', async (request, reply) => {
    if (request.url.startsWith('/docs')) {
      reply.removeHeader('content-security-policy')
      reply.removeHeader('cross-origin-embedder-policy')
    }
  })

  await requestIdPlugin(app)
  await errorHandlerPlugin(app)
  await healthPlugin(app)

  const db = getDb()

  const auditRepo = new PostgresAuditRepository(db)
  const companyRepo = new PostgresCompanyRepository(db)
  const contactRepo = new PostgresContactRepository(db)
  const dealRepo = new PostgresDealRepository(db)
  const exportRepo = new PostgresExportRepository(db)
  const importRepo = new PostgresImportRepository(db)
  const leadRepo = new PostgresLeadRepository(db)
  const membershipRepo = new PostgresMembershipRepository(db)
  const organizationRepo = new PostgresOrganizationRepository(db)
  const taskRepo = new PostgresTaskRepository(db)
  const userRepo = new PostgresUserRepository(db)

  const auditService = new AuditService(auditRepo)
  const companyService = new CompanyService(companyRepo)
  const contactService = new ContactService(contactRepo)
  const dealService = new DealService(dealRepo)
  const exportService = new ExportService(db, exportRepo)
  const importService = new ImportService(db, importRepo)
  const leadService = new LeadService(leadRepo)
  const memberService = new MemberService(
    new PostgresMemberRepository(db),
    userRepo,
  )
  const organizationService = new OrganizationService(organizationRepo)
  const taskService = new TaskService(taskRepo)
  const authService = new AuthService(
    userRepo,
    membershipRepo,
    organizationRepo,
    new PostgresPasswordResetRepository(db),
  )

  await new AuthRoutes(authService).register(app)
  await new AuditRoutes(auditService).register(app)
  await new CompanyRoutes(companyService).register(app)
  await new ContactRoutes(contactService).register(app)
  await new DealRoutes(dealService).register(app)
  await new ExportRoutes(exportService).register(app)
  await new ImportRoutes(importService).register(app)
  const convertLead = new ConvertLead(db).toFn()
  await new LeadRoutes(leadService, convertLead).register(app)
  await new MemberRoutes(memberService).register(app)
  await new OrganizationRoutes(organizationService).register(app)
  await new TaskRoutes(taskService).register(app)

  return app
}
