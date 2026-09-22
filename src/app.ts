import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import cookie from '@fastify/cookie'
import { randomUUID } from 'node:crypto'
import { config } from './shared/config.js'
import { getDb } from './shared/database/connection.js'
import { requestIdPlugin } from './shared/http/requestId.js'
import { errorHandlerPlugin } from './shared/http/errorHandler.js'
import { healthPlugin } from './shared/http/health.js'

import { PostgresAuditRepository } from './modules/audit/infrastructure/PostgresAuditRepository.js'
import { PostgresCompanyRepository } from './modules/companies/infrastructure/PostgresCompanyRepository.js'
import { PostgresContactRepository } from './modules/contacts/infrastructure/PostgresContactRepository.js'
import { PostgresDealRepository } from './modules/deals/infrastructure/PostgresDealRepository.js'
import { PostgresExportRepository } from './modules/exports/infrastructure/PostgresExportRepository.js'
import { PostgresImportRepository } from './modules/imports/infrastructure/PostgresImportRepository.js'
import { PostgresLeadRepository } from './modules/leads/infrastructure/PostgresLeadRepository.js'
import { PostgresMembershipRepository } from './modules/users/infrastructure/PostgresMembershipRepository.js'
import { PostgresOrganizationRepository } from './modules/organizations/infrastructure/PostgresOrganizationRepository.js'
import { PostgresTaskRepository } from './modules/tasks/infrastructure/PostgresTaskRepository.js'
import { PostgresUserRepository } from './modules/users/infrastructure/PostgresUserRepository.js'

import { AuditService } from './modules/audit/application/AuditService.js'
import { CompanyService } from './modules/companies/application/CompanyService.js'
import { ContactService } from './modules/contacts/application/ContactService.js'
import { DealService } from './modules/deals/application/DealService.js'
import { ExportService } from './modules/exports/application/ExportService.js'
import { ImportService } from './modules/imports/application/ImportService.js'
import { LeadService } from './modules/leads/application/LeadService.js'
import { ConvertLead } from './modules/leads/application/ConvertLead.js'
import { MemberService } from './modules/members/application/MemberService.js'
import { OrganizationService } from './modules/organizations/application/OrganizationService.js'
import { TaskService } from './modules/tasks/application/TaskService.js'
import { AuthService } from './modules/users/application/auth.js'

import { AuditRoutes } from './modules/audit/http/auditRoutes.js'
import { AuthRoutes } from './modules/users/http/authRoutes.js'
import { CompanyRoutes } from './modules/companies/http/companyRoutes.js'
import { ContactRoutes } from './modules/contacts/http/contactRoutes.js'
import { DealRoutes } from './modules/deals/http/dealRoutes.js'
import { ExportRoutes } from './modules/exports/http/exportRoutes.js'
import { ImportRoutes } from './modules/imports/http/importRoutes.js'
import { LeadRoutes } from './modules/leads/http/leadRoutes.js'
import { MemberRoutes } from './modules/members/http/memberRoutes.js'
import { OrganizationRoutes } from './modules/organizations/http/organizationRoutes.js'
import { TaskRoutes } from './modules/tasks/http/taskRoutes.js'

export async function buildApp() {
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
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })

  await app.register(cookie)
  await app.register(requestIdPlugin)
  await app.register(errorHandlerPlugin)
  await app.register(healthPlugin)

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
  const memberService = new MemberService(membershipRepo, userRepo)
  const organizationService = new OrganizationService(organizationRepo)
  const taskService = new TaskService(taskRepo)
  const authService = new AuthService(
    userRepo,
    membershipRepo,
    organizationRepo,
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
