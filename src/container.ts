import type { FastifyInstance } from 'fastify'
import { database } from './shared/database/connection.js'
import { config } from './shared/config.js'
import { PostgresCompanyRepository } from './modules/crm/companies/infrastructure/PostgresCompanyRepository.js'
import { PostgresContactRepository } from './modules/crm/contacts/infrastructure/PostgresContactRepository.js'
import { PostgresDealRepository } from './modules/crm/deals/infrastructure/PostgresDealRepository.js'
import { PostgresExportRepository } from './modules/bulk/exports/infrastructure/PostgresExportRepository.js'
import { PostgresImportRepository } from './modules/bulk/imports/infrastructure/PostgresImportRepository.js'
import { PostgresLeadRepository } from './modules/crm/leads/infrastructure/PostgresLeadRepository.js'
import { PostgresMembershipRepository } from './modules/users/infrastructure/PostgresMembershipRepository.js'
import { PostgresUserRepository } from './modules/users/infrastructure/PostgresUserRepository.js'
import { CompanyService } from './modules/crm/companies/application/CompanyService.js'
import { ContactService } from './modules/crm/contacts/application/ContactService.js'
import { DealService } from './modules/crm/deals/application/DealService.js'
import { ExportService } from './modules/bulk/exports/application/ExportService.js'
import { ImportService } from './modules/bulk/imports/application/ImportService.js'
import { LeadService } from './modules/crm/leads/application/LeadService.js'
import { ConvertLead } from './modules/crm/leads/application/ConvertLead.js'
import { AuthService } from './modules/users/application/auth.js'
import { AuthRoutes } from './modules/users/http/authRoutes.js'
import { CompanyRoutes } from './modules/crm/companies/http/companyRoutes.js'
import { ContactRoutes } from './modules/crm/contacts/http/contactRoutes.js'
import { DealRoutes } from './modules/crm/deals/http/dealRoutes.js'
import { ExportRoutes } from './modules/bulk/exports/http/exportRoutes.js'
import { ImportRoutes } from './modules/bulk/imports/http/importRoutes.js'
import { LeadRoutes } from './modules/crm/leads/http/leadRoutes.js'

export interface ContainerOptions {
  storageDir?: string
}

export class Container {
  private readonly storageDir: string
  private readonly authService: AuthService
  private readonly companyService: CompanyService
  private readonly contactService: ContactService
  private readonly dealService: DealService
  private readonly exportService: ExportService
  private readonly importService: ImportService
  private readonly leadService: LeadService
  private readonly convertLead: ReturnType<ConvertLead['toFn']>

  constructor(options: ContainerOptions = {}) {
    const db = database.db
    this.storageDir = options.storageDir ?? config.storageDir

    const companyRepo = new PostgresCompanyRepository(db)
    const contactRepo = new PostgresContactRepository(db)
    const dealRepo = new PostgresDealRepository(db)
    const exportRepo = new PostgresExportRepository(db)
    const importRepo = new PostgresImportRepository(db)
    const leadRepo = new PostgresLeadRepository(db)
    const userRepo = new PostgresUserRepository(db)
    const membershipRepo = new PostgresMembershipRepository(db)

    this.companyService = new CompanyService(companyRepo)
    this.contactService = new ContactService(contactRepo)
    this.dealService = new DealService(dealRepo)
    this.exportService = new ExportService(db, exportRepo)
    this.importService = new ImportService(db, importRepo)
    this.leadService = new LeadService(leadRepo)
    this.authService = new AuthService(db, userRepo, membershipRepo)
    this.convertLead = new ConvertLead(db).toFn()
  }

  async registerRoutes(app: FastifyInstance): Promise<void> {
    await new AuthRoutes(this.authService).register(app)
    await new CompanyRoutes(this.companyService).register(app)
    await new ContactRoutes(this.contactService).register(app)
    await new DealRoutes(this.dealService).register(app)
    await new ExportRoutes(this.exportService, this.storageDir).register(app)
    await new ImportRoutes(this.importService, this.storageDir).register(app)
    await new LeadRoutes(this.leadService, this.convertLead).register(app)
  }
}
