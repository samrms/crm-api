// This file defines the Kysely database schema types.
// It is the single source of truth for table structure.
// Modules extend this via declaration merging or direct imports.

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

export interface SessionsTable {
  id: string
  token: string
  user_id: string
  organization_id: string
  expires_at: Date
  revoked_at: Date | null
  created_at: Date
}

export interface Database {
  organizations: OrganizationsTable
  users: UsersTable
  memberships: MembershipsTable
  sessions: SessionsTable
  // Tables added by modules below:
  companies: CompaniesTable
  contacts: ContactsTable
  leads: LeadsTable
  deals: DealsTable
  activities: ActivitiesTable
  tasks: TasksTable
  audit_events: AuditEventsTable
  outbox_events: OutboxEventsTable
  imports: ImportsTable
  exports: ExportsTable
  jobs: JobsTable
  kysely_migrations: KyselyMigrationsTable
}

// CRM entities (added here to keep Database in one place)
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

export interface ActivitiesTable {
  id: string
  organization_id: string
  dealId: string | null
  leadId: string | null
  contactId: string | null
  companyId: string | null
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'NOTE' | 'TASK'
  subject: string
  body: string | null
  occurredAt: Date
  created_at: Date
  updated_at: Date
}

export interface TasksTable {
  id: string
  organization_id: string
  dealId: string | null
  leadId: string | null
  contactId: string | null
  title: string
  description: string | null
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  dueDate: Date | null
  assignedToId: string | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export interface AuditEventsTable {
  id: string
  organization_id: string
  actor_id: string
  action: string
  resource_type: string
  resource_id: string | null
  request_id: string | null
  metadata: Record<string, unknown> | null
  created_at: Date
}

export interface OutboxEventsTable {
  id: string
  organization_id: string
  type: string
  payload: Record<string, unknown>
  processed_at: Date | null
  created_at: Date
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

export interface JobsTable {
  id: string
  organization_id: string
  actor_id: string
  type: string
  status:
    'PENDING' | 'PROCESSING' | 'RETRYING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  attempts: number
  max_attempts: number
  available_at: Date
  started_at: Date | null
  completed_at: Date | null
  failed_at: Date | null
  last_error_code: string | null
  last_error_message: string | null
  payload: Record<string, unknown>
  created_at: Date
}

export interface KyselyMigrationsTable {
  name: string
  timestamp: number
}
