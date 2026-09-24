import {
  bool,
  dateTime,
  email,
  entity,
  int,
  nullableDateTime,
  nullableStr,
  num,
  ref,
  str,
  type Schema,
} from './helpers.js'

export const schemas: Record<string, Schema> = {
  Error: {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message', 'requestId'],
        properties: {
          code: { type: 'string', example: 'NOT_FOUND' },
          message: str,
          requestId: {
            type: 'string',
            description: 'Echoes the X-Request-Id response header',
          },
          details: { type: 'object', additionalProperties: true },
        },
      },
    },
  },
  Pagination: {
    type: 'object',
    required: ['limit', 'hasNextPage', 'nextCursor'],
    properties: {
      limit: int,
      hasNextPage: bool,
      nextCursor: {
        ...nullableStr,
        description: 'Pass back as ?after= to fetch the next page',
      },
    },
  },
  AuthUser: {
    type: 'object',
    required: ['id', 'email', 'name'],
    properties: { id: str, email, name: str },
  },
  Organization: {
    type: 'object',
    required: ['id', 'name', 'slug'],
    properties: { id: str, name: str, slug: str },
  },
  AuthSession: {
    type: 'object',
    required: ['user', 'organization', 'token', 'expiresAt'],
    properties: {
      user: ref('AuthUser'),
      organization: ref('Organization'),
      token: {
        type: 'string',
        description:
          'Signed JWT. Also set as the `session` cookie. Send as `Cookie: session=<token>` or `Authorization: Bearer <token>`. Expires after JWT_TTL_MINUTES and cannot be revoked before then.',
      },
      expiresAt: { type: 'string', format: 'date-time' },
    },
  },
  Me: {
    type: 'object',
    required: ['user'],
    properties: {
      user: ref('AuthUser'),
      organization: {
        ...ref('Organization'),
        nullable: true,
        description: 'Null when the organization no longer exists',
      },
      role: {
        type: 'string',
        enum: ['OWNER', 'ADMIN', 'MEMBER'],
        nullable: true,
      },
    },
  },
  RegisterRequest: {
    type: 'object',
    required: ['email', 'password', 'name', 'organizationName'],
    properties: {
      email,
      password: { type: 'string', minLength: 8, maxLength: 128 },
      name: { type: 'string', minLength: 1, maxLength: 255 },
      organizationName: { type: 'string', minLength: 1, maxLength: 255 },
    },
  },
  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: { email, password: str },
  },
  PasswordChangeRequest: {
    type: 'object',
    required: ['currentPassword', 'password'],
    properties: {
      currentPassword: str,
      password: { type: 'string', minLength: 8, maxLength: 128 },
    },
  },
  Company: entity({
    id: str,
    organization_id: str,
    name: str,
    domain: nullableStr,
    industry: nullableStr,
    size: nullableStr,
    website: nullableStr,
    notes: nullableStr,
  }),
  CreateCompanyRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      domain: { type: 'string', maxLength: 255 },
      industry: { type: 'string', maxLength: 255 },
      size: { type: 'string', maxLength: 50 },
      website: { type: 'string', format: 'uri', maxLength: 255 },
    },
  },
  UpdateCompanyRequest: {
    type: 'object',
    description: 'At least one field is required',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      domain: { type: 'string', maxLength: 255 },
      industry: { type: 'string', maxLength: 255 },
      size: { type: 'string', maxLength: 50 },
      website: { type: 'string', format: 'uri', maxLength: 255 },
    },
  },
  Contact: entity({
    id: str,
    organization_id: str,
    company_id: nullableStr,
    email,
    firstName: str,
    lastName: str,
    phone: nullableStr,
    title: nullableStr,
    notes: nullableStr,
  }),
  CreateContactRequest: {
    type: 'object',
    required: ['email', 'firstName', 'lastName'],
    properties: {
      companyId: str,
      email,
      firstName: { type: 'string', minLength: 1, maxLength: 255 },
      lastName: { type: 'string', minLength: 1, maxLength: 255 },
      phone: { type: 'string', maxLength: 50 },
      title: { type: 'string', maxLength: 255 },
      notes: { type: 'string', maxLength: 5000 },
    },
  },
  UpdateContactRequest: {
    type: 'object',
    properties: {
      companyId: str,
      email,
      firstName: { type: 'string', minLength: 1, maxLength: 255 },
      lastName: { type: 'string', minLength: 1, maxLength: 255 },
      phone: { type: 'string', maxLength: 50 },
      title: { type: 'string', maxLength: 255 },
      notes: { type: 'string', maxLength: 5000 },
    },
  },
  Lead: entity({
    id: str,
    organization_id: str,
    companyId: nullableStr,
    contactId: nullableStr,
    email,
    firstName: str,
    lastName: str,
    company: nullableStr,
    source: nullableStr,
    status: {
      type: 'string',
      enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'DISQUALIFIED'],
    },
    convertedDealId: nullableStr,
    notes: nullableStr,
    version: int,
  }),
  CreateLeadRequest: {
    type: 'object',
    required: ['email', 'firstName', 'lastName'],
    properties: {
      email,
      firstName: { type: 'string', minLength: 1, maxLength: 255 },
      lastName: { type: 'string', minLength: 1, maxLength: 255 },
      company: { type: 'string', maxLength: 255 },
      source: { type: 'string', maxLength: 255 },
      notes: { type: 'string', maxLength: 5000 },
    },
  },
  UpdateLeadRequest: {
    type: 'object',
    properties: {
      email,
      firstName: { type: 'string', minLength: 1, maxLength: 255 },
      lastName: { type: 'string', minLength: 1, maxLength: 255 },
      company: { type: 'string', maxLength: 255 },
      source: { type: 'string', maxLength: 255 },
      notes: { type: 'string', maxLength: 5000 },
    },
  },
  ConvertLeadRequest: {
    type: 'object',
    properties: {
      companyName: { type: 'string', maxLength: 255 },
      dealTitle: { type: 'string', maxLength: 255 },
      dealValue: { type: 'number', minimum: 0, exclusiveMinimum: true },
    },
  },
  Deal: entity({
    id: str,
    organization_id: str,
    companyId: nullableStr,
    contactId: nullableStr,
    leadId: nullableStr,
    title: str,
    value: { type: 'number', nullable: true },
    currency: { type: 'string', minLength: 3, maxLength: 3 },
    stage: {
      type: 'string',
      enum: ['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'],
    },
    expectedCloseDate: nullableDateTime,
    notes: nullableStr,
    version: int,
  }),
  CreateDealRequest: {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 255 },
      companyId: str,
      contactId: str,
      leadId: str,
      value: { type: 'number', minimum: 0, exclusiveMinimum: true },
      currency: { type: 'string', minLength: 3, maxLength: 3 },
      notes: { type: 'string', maxLength: 5000 },
    },
  },
  UpdateDealRequest: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 255 },
      companyId: str,
      contactId: str,
      value: { type: 'number', minimum: 0, exclusiveMinimum: true },
      currency: { type: 'string', minLength: 3, maxLength: 3 },
      notes: { type: 'string', maxLength: 5000 },
    },
  },
  AdvanceDealRequest: {
    type: 'object',
    required: ['stage'],
    properties: {
      stage: {
        type: 'string',
        enum: ['QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'],
      },
    },
  },
  ConversionResult: {
    type: 'object',
    required: ['lead', 'deal', 'company', 'contact'],
    properties: {
      lead: ref('Lead'),
      deal: ref('Deal'),
      company: ref('Company'),
      contact: ref('Contact'),
    },
  },
  ImportJob: entity({
    id: str,
    organization_id: str,
    actor_id: str,
    type: { type: 'string', enum: ['companies', 'contacts', 'leads'] },
    status: {
      type: 'string',
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
    },
    total: int,
    processed: int,
    successful: int,
    failed: int,
    file_path: nullableStr,
    error_message: nullableStr,
  }),
  ImportAccepted: {
    type: 'object',
    required: ['id', 'status', 'type'],
    properties: { id: str, status: str, type: str },
  },
  CreateImportRequest: {
    type: 'object',
    required: ['type'],
    properties: {
      type: { type: 'string', enum: ['companies', 'contacts', 'leads'] },
      content: {
        type: 'string',
        description: 'CSV text to import (max 900k characters)',
      },
    },
  },
  ExportJob: entity({
    id: str,
    organization_id: str,
    actor_id: str,
    type: { type: 'string', enum: ['companies', 'contacts', 'leads'] },
    status: {
      type: 'string',
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
    },
    file_path: nullableStr,
    download_url: nullableStr,
    error_message: nullableStr,
  }),
  CreateExportRequest: {
    type: 'object',
    required: ['type'],
    properties: {
      type: { type: 'string', enum: ['companies', 'contacts', 'leads'] },
    },
  },
  Message: {
    type: 'object',
    required: ['message'],
    properties: { message: str },
  },
  ServiceInfo: {
    type: 'object',
    properties: { status: str, name: str, docs: str, health: str },
  },
  Health: {
    type: 'object',
    properties: { status: str, timestamp: dateTime },
  },
  Readiness: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ready', 'degraded'] },
      checks: { type: 'object', additionalProperties: str },
      timestamp: dateTime,
    },
  },
  Metrics: {
    type: 'object',
    properties: {
      uptime: num,
      memory: { type: 'object', additionalProperties: num },
      timestamp: dateTime,
    },
  },
}
