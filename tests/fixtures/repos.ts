import { vi } from 'vitest'
import type {
  CompanyRepository,
  CompanyRow,
} from '../../src/modules/crm/companies/infrastructure/PostgresCompanyRepository.ts'
import type {
  ContactRepository,
  ContactRow,
} from '../../src/modules/crm/contacts/infrastructure/PostgresContactRepository.ts'
import type {
  LeadRepository,
  LeadRow,
} from '../../src/modules/crm/leads/infrastructure/PostgresLeadRepository.ts'
import type {
  DealRepository,
  DealRow,
} from '../../src/modules/crm/deals/infrastructure/PostgresDealRepository.ts'

const now = () => new Date()

export const companyRow = (
  overrides: Partial<CompanyRow> = {},
): CompanyRow => ({
  id: 'co_1',
  organization_id: 'org_1',
  name: 'Acme',
  domain: null,
  industry: null,
  size: null,
  website: null,
  notes: null,
  created_at: now(),
  updated_at: now(),
  deleted_at: null,
  ...overrides,
})

export const contactRow = (
  overrides: Partial<ContactRow> = {},
): ContactRow => ({
  id: 'ct_1',
  organization_id: 'org_1',
  company_id: null,
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  phone: null,
  title: null,
  notes: null,
  created_at: now(),
  updated_at: now(),
  deleted_at: null,
  ...overrides,
})

export const leadRow = (overrides: Partial<LeadRow> = {}): LeadRow => ({
  id: 'ld_1',
  organization_id: 'org_1',
  companyId: null,
  contactId: null,
  email: 'lead@example.com',
  firstName: 'Jane',
  lastName: 'Smith',
  company: null,
  source: null,
  status: 'NEW',
  convertedDealId: null,
  notes: null,
  created_at: now(),
  updated_at: now(),
  deleted_at: null,
  version: 1,
  ...overrides,
})

export const dealRow = (overrides: Partial<DealRow> = {}): DealRow => ({
  id: 'dl_1',
  organization_id: 'org_1',
  companyId: null,
  contactId: null,
  leadId: null,
  title: 'Big Deal',
  value: 1_000,
  currency: 'USD',
  stage: 'NEW',
  expectedCloseDate: null,
  notes: null,
  created_at: now(),
  updated_at: now(),
  deleted_at: null,
  version: 1,
  ...overrides,
})

export const companyRepo = (
  overrides: Partial<CompanyRepository> = {},
): CompanyRepository =>
  ({
    findById: vi.fn().mockResolvedValue(companyRow()),
    findByName: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([companyRow()]),
    create: vi.fn().mockImplementation((data) => companyRow(data as never)),
    update: vi.fn().mockResolvedValue(companyRow({ name: 'Updated' })),
    softDelete: vi.fn().mockResolvedValue(true),
    ...overrides,
  }) as CompanyRepository

export const contactRepo = (
  overrides: Partial<ContactRepository> = {},
): ContactRepository =>
  ({
    findById: vi.fn().mockResolvedValue(contactRow()),
    list: vi.fn().mockResolvedValue([contactRow()]),
    create: vi.fn().mockImplementation((data) => contactRow(data as never)),
    update: vi.fn().mockResolvedValue(contactRow({ firstName: 'Jane' })),
    softDelete: vi.fn().mockResolvedValue(true),
    ...overrides,
  }) as ContactRepository

export const leadRepo = (
  overrides: Partial<LeadRepository> = {},
): LeadRepository =>
  ({
    findById: vi.fn().mockResolvedValue(leadRow()),
    list: vi.fn().mockResolvedValue([leadRow()]),
    create: vi.fn().mockImplementation((data) => leadRow(data as never)),
    update: vi.fn().mockResolvedValue(leadRow({ firstName: 'Janet' })),
    updateStatus: vi.fn().mockResolvedValue(leadRow({ status: 'CONTACTED' })),
    softDelete: vi.fn().mockResolvedValue(true),
    ...overrides,
  }) as LeadRepository

export const dealRepo = (
  overrides: Partial<DealRepository> = {},
): DealRepository =>
  ({
    findById: vi.fn().mockResolvedValue(dealRow()),
    list: vi.fn().mockResolvedValue([dealRow()]),
    create: vi.fn().mockImplementation((data) => dealRow(data as never)),
    update: vi.fn().mockResolvedValue(dealRow({ title: 'Renamed' })),
    updateStage: vi.fn().mockResolvedValue(dealRow({ stage: 'QUALIFIED' })),
    softDelete: vi.fn().mockResolvedValue(true),
    ...overrides,
  }) as DealRepository
