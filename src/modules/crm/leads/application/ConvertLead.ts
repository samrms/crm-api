import type { Kysely } from 'kysely'
import { newId } from '@/shared/utils/id.js'
import { PostgresCompanyRepository } from '@/modules/crm/companies/infrastructure/PostgresCompanyRepository.js'
import { PostgresContactRepository } from '@/modules/crm/contacts/infrastructure/PostgresContactRepository.js'
import { PostgresDealRepository } from '@/modules/crm/deals/infrastructure/PostgresDealRepository.js'
import { canTransitionLead } from '@/modules/crm/leads/domain/LeadState.js'
import {
  OptimisticLockError,
  ValidationError,
  NotFoundError,
} from '@/shared/errors/AppError.js'
import type { Database } from '@/shared/database/types.js'
import type { LeadsTable } from '@/shared/database/types.js'

export interface ConvertLeadInput {
  leadId: string
  organizationId: string
  companyName?: string
  dealTitle?: string
  dealValue?: number
}

export interface ConversionResult {
  lead: { id: string; status: string }
  company: { id: string; name: string }
  contact: { id: string; email: string }
  deal: { id: string; title: string; stage: string; value: number | null }
}

export type ConvertLeadFn = (
  input: ConvertLeadInput,
) => Promise<ConversionResult>

export class ConvertLead {
  constructor(private readonly db: Kysely<Database>) {}

  toFn(): ConvertLeadFn {
    return (input) => this.execute(input)
  }

  async execute(input: ConvertLeadInput): Promise<ConversionResult> {
    const { leadId, organizationId } = input

    return this.db.transaction().execute(async (trx) => {
      const companyRepo = new PostgresCompanyRepository(trx)
      const contactRepo = new PostgresContactRepository(trx)
      const dealRepo = new PostgresDealRepository(trx)

      const leadRow = await trx
        .selectFrom('leads')
        .selectAll()
        .where('id', '=', leadId)
        .where('organization_id', '=', organizationId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst()

      if (!leadRow) {
        throw new NotFoundError('Lead', leadId)
      }

      const lead: LeadsTable = leadRow

      if (!canTransitionLead(lead.status, 'CONVERTED')) {
        throw new ValidationError(
          `Lead in status '${lead.status}' cannot be converted`,
        )
      }

      const companyName =
        input.companyName ??
        lead.company ??
        lead.email.split('@')[1] ??
        'Unknown Company'
      let company = await companyRepo.findByName(companyName, organizationId)
      if (!company) {
        company = await companyRepo.create({
          id: newId('co'),
          organizationId,
          name: companyName,
        })
      }

      let contact = await contactRepo.findByEmailAndCompany(
        lead.email,
        company.id,
        organizationId,
      )
      if (!contact) {
        contact = await contactRepo.create({
          id: newId('ct'),
          organizationId,
          companyId: company.id,
          email: lead.email,
          firstName: lead.firstName,
          lastName: lead.lastName,
        })
      }

      const dealTitle =
        input.dealTitle ?? `Deal from lead: ${lead.firstName} ${lead.lastName}`
      const deal = await dealRepo.create({
        id: newId('dl'),
        organizationId,
        title: dealTitle,
        companyId: company.id,
        contactId: contact.id,
        leadId: lead.id,
        value: input.dealValue ?? undefined,
      })

      const updatedLead = await trx
        .updateTable('leads')
        .set({
          status: 'CONVERTED',
          version: lead.version + 1,
          updated_at: new Date(),
        })
        .where('id', '=', leadId)
        .where('organization_id', '=', organizationId)
        .where('version', '=', lead.version)
        .returningAll()
        .executeTakeFirst()

      if (!updatedLead) {
        throw new OptimisticLockError('Lead')
      }

      await trx
        .updateTable('leads')
        .set({ convertedDealId: deal.id, updated_at: new Date() })
        .where('id', '=', leadId)
        .where('organization_id', '=', organizationId)
        .execute()

      return {
        lead: { id: lead.id, status: 'CONVERTED' },
        company: { id: company.id, name: company.name },
        contact: { id: contact.id, email: contact.email },
        deal: {
          id: deal.id,
          title: deal.title,
          stage: deal.stage,
          value: deal.value ?? null,
        },
      }
    })
  }
}
