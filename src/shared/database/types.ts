export type Role = 'OWNER' | 'ADMIN' | 'MEMBER'

export interface OrganizationsTable {
  id: string
  name: string
  slug: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export interface UsersTable {
  id: string
  email: string
  name: string
  password_hash: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export interface MembershipsTable {
  id: string
  user_id: string
  organization_id: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  created_at: Date
  updated_at: Date
}

export interface Database {
  organizations: OrganizationsTable
  users: UsersTable
  memberships: MembershipsTable
  companies: CompaniesTable
  contacts: ContactsTable
  leads: LeadsTable
  deals: DealsTable
  imports: ImportsTable
  exports: ExportsTable
  kysely_migrations: KyselyMigrationsTable
}

export interface CompaniesTable {
  id: string
  organization_id: string
  name: string
  domain: string | null
  industry: string | null
  size: string | null
  website: string | null
  notes: string | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export interface ContactsTable {
  id: string
  organization_id: string
  company_id: string | null
  email: string
  firstName: string
  lastName: string
  phone: string | null
  title: string | null
  notes: string | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export interface LeadsTable {
  id: string
  organization_id: string
  companyId: string | null
  contactId: string | null
  email: string
  firstName: string
  lastName: string
  company: string | null
  source: string | null
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'DISQUALIFIED'
  convertedDealId: string | null
  notes: string | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  version: number
}

export interface DealsTable {
  id: string
  organization_id: string
  companyId: string | null
  contactId: string | null
  leadId: string | null
  title: string
  value: number | null
  currency: string
  stage: 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST'
  expectedCloseDate: Date | null
  notes: string | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  version: number
}

export interface ImportsTable {
  id: string
  organization_id: string
  actor_id: string
  type: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  total: number
  processed: number
  successful: number
  failed: number
  file_path: string | null
  error_message: string | null
  created_at: Date
  updated_at: Date
}

export interface ExportsTable {
  id: string
  organization_id: string
  actor_id: string
  type: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  file_path: string | null
  download_url: string | null
  error_message: string | null
  created_at: Date
  updated_at: Date
}

export interface KyselyMigrationsTable {
  name: string
  timestamp: number
}
