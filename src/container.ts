import type { FastifyInstance } from 'fastify'
import { getDb } from './shared/database/connection.js'
import { config } from './shared/config.js'

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

export interface ContainerOptions {
  storageDir?: string
}

export interface AppContainer {
  registerRoutes(app: FastifyInstance): Promise<void>
}

export function buildContainer(options: ContainerOptions = {}): AppContainer {
  const db = getDb()
  const storageDir = options.storageDir ?? config.storageDir

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
  const convertLead = new ConvertLead(db).toFn()

  return {
    async registerRoutes(app: FastifyInstance): Promise<void> {
      await new AuthRoutes(authService).register(app)
      await new AuditRoutes(auditService).register(app)
      await new CompanyRoutes(companyService).register(app)
      await new ContactRoutes(contactService).register(app)
      await new DealRoutes(dealService).register(app)
      await new ExportRoutes(exportService, storageDir).register(app)
      await new ImportRoutes(importService, storageDir).register(app)
      await new LeadRoutes(leadService, convertLead).register(app)
      await new MemberRoutes(memberService).register(app)
      await new OrganizationRoutes(organizationService).register(app)
      await new TaskRoutes(taskService).register(app)
    },
  }
}
