import type swagger from '@fastify/swagger'
import type { OpenAPIV3 } from 'openapi-types'

type SwaggerOptions = Extract<
  Parameters<typeof swagger>[1],
  { mode?: 'static' }
>
type Schema = OpenAPIV3.SchemaObject
type SchemaLike = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject

const SESSION_COOKIE: OpenAPIV3.SecuritySchemeObject = {
  type: 'apiKey',
  in: 'cookie',
  name: 'session',
  description: 'Session cookie issued by /api/v1/auth/register or /login',
}
const secured: OpenAPIV3.SecurityRequirementObject[] = [{ sessionCookie: [] }]

const str: Schema = { type: 'string' }
const nullableStr: Schema = { type: 'string', nullable: true }
const int: Schema = { type: 'integer' }
const num: Schema = { type: 'number' }
const bool: Schema = { type: 'boolean' }
const dateTime: Schema = { type: 'string', format: 'date-time' }
const nullableDateTime: Schema = {
  type: 'string',
  format: 'date-time',
  nullable: true,
}
const email: Schema = { type: 'string', format: 'email' }

const ref = (name: string): SchemaLike => ({
  $ref: `#/components/schemas/${name}`,
})
const timestamps = {
  created_at: dateTime,
  updated_at: dateTime,
  deleted_at: nullableDateTime,
}
const entity = (properties: Record<string, Schema>): Schema => ({
  type: 'object',
  properties: { ...properties, ...timestamps },
})

const json = (
  description: string,
  schema: SchemaLike,
): OpenAPIV3.ResponseObject => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string): OpenAPIV3.ResponseObject =>
  json(description, ref('Error'))
const ok = (
  description: string,
  schema: SchemaLike,
): OpenAPIV3.ResponseObject => json(description, schema)
const data = (schema: SchemaLike): Schema => ({
  type: 'object',
  required: ['data'],
  properties: { data: schema },
})
const page = (item: string): Schema => ({
  type: 'object',
  required: ['data', 'pagination'],
  properties: {
    data: { type: 'array', items: ref(item) },
    pagination: ref('Pagination'),
  },
})

const jsonBody = (schemaName: string): OpenAPIV3.RequestBodyObject => ({
  required: true,
  content: { 'application/json': { schema: ref(schemaName) } },
})
const idParam: OpenAPIV3.ParameterObject = {
  name: 'id',
  in: 'path',
  required: true,
  description: 'Resource id',
  schema: str,
}
const query = (
  name: string,
  description: string,
  schema: Schema = str,
): OpenAPIV3.ParameterObject => ({
  name,
  in: 'query',
  required: false,
  description,
  schema,
})
const limitParam = query('limit', 'Page size (1-100, default 25)', int)
const afterParam = query(
  'after',
  'Cursor from a previous response `pagination.nextCursor`',
)

const noContent: OpenAPIV3.ResponseObject = { description: 'No content' }
const unauthorized = err('Authentication required')
const forbidden = err('Forbidden: requires OWNER or ADMIN role')
const notFound = (resource: string) => err(`${resource} not found`)
const validationFailed = err('Validation failed')
const rateLimited = err('Rate limit exceeded')
const serverError = err('Internal server error')

const schemas: Record<string, Schema> = {
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
    required: ['user', 'organization'],
    properties: { user: ref('AuthUser'), organization: ref('Organization') },
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

const paths: OpenAPIV3.PathsObject = {
  '/api/v1/auth/register': {
    post: {
      tags: ['Auth'],
      summary: 'Register a new organization and owner',
      operationId: 'register',
      requestBody: jsonBody('RegisterRequest'),
      responses: {
        201: ok(
          'Organization, owner and session created (session cookie set)',
          data(ref('AuthSession')),
        ),
        409: err('Conflict: email already registered'),
        422: validationFailed,
        429: rateLimited,
      },
    },
  },
  '/api/v1/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Login',
      operationId: 'login',
      requestBody: jsonBody('LoginRequest'),
      responses: {
        200: ok('Authenticated (session cookie set)', data(ref('AuthSession'))),
        401: err('Invalid email or password'),
        422: validationFailed,
        429: rateLimited,
      },
    },
  },
  '/api/v1/auth/password/change': {
    post: {
      tags: ['Auth'],
      summary: 'Change password (revokes other sessions)',
      operationId: 'changePassword',
      security: secured,
      requestBody: jsonBody('PasswordChangeRequest'),
      responses: {
        200: ok('Password updated', data(ref('Message'))),
        401: err('Current password incorrect'),
        422: validationFailed,
      },
    },
  },
  '/api/v1/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Logout (revoke session)',
      operationId: 'logout',
      security: secured,
      responses: { 204: noContent, 401: unauthorized },
    },
  },
  '/api/v1/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'Get current user, organization and role',
      operationId: 'getMe',
      security: secured,
      responses: {
        200: ok('Current identity', data(ref('Me'))),
        401: unauthorized,
      },
    },
  },
  '/api/v1/companies': {
    get: {
      tags: ['Companies'],
      summary: 'List companies',
      operationId: 'listCompanies',
      security: secured,
      parameters: [
        limitParam,
        afterParam,
        query('name', 'Case-insensitive name filter'),
      ],
      responses: {
        200: ok('Cursor-paginated companies', page('Company')),
        422: validationFailed,
        429: rateLimited,
        500: serverError,
      },
    },
    post: {
      tags: ['Companies'],
      summary: 'Create company',
      operationId: 'createCompany',
      security: secured,
      requestBody: jsonBody('CreateCompanyRequest'),
      responses: {
        201: ok('Company created', data(ref('Company'))),
        401: unauthorized,
        403: forbidden,
        422: validationFailed,
        429: rateLimited,
        500: serverError,
      },
    },
  },
  '/api/v1/companies/{id}': {
    get: {
      tags: ['Companies'],
      summary: 'Get company',
      operationId: 'getCompany',
      security: secured,
      parameters: [idParam],
      responses: {
        200: ok('Company', data(ref('Company'))),
        401: unauthorized,
        404: notFound('Company'),
        429: rateLimited,
        500: serverError,
      },
    },
    patch: {
      tags: ['Companies'],
      summary: 'Update company',
      operationId: 'updateCompany',
      security: secured,
      parameters: [idParam],
      requestBody: jsonBody('UpdateCompanyRequest'),
      responses: {
        200: ok('Company updated', data(ref('Company'))),
        401: unauthorized,
        403: forbidden,
        404: notFound('Company'),
        422: validationFailed,
        429: rateLimited,
        500: serverError,
      },
    },
    delete: {
      tags: ['Companies'],
      summary: 'Soft delete company',
      operationId: 'deleteCompany',
      security: secured,
      parameters: [idParam],
      responses: {
        204: noContent,
        401: unauthorized,
        403: forbidden,
        404: notFound('Company'),
        429: rateLimited,
        500: serverError,
      },
    },
  },
  '/api/v1/contacts': {
    get: {
      tags: ['Contacts'],
      summary: 'List contacts',
      operationId: 'listContacts',
      security: secured,
      parameters: [limitParam, afterParam],
      responses: {
        200: ok('Cursor-paginated contacts', page('Contact')),
        422: validationFailed,
        429: rateLimited,
        500: serverError,
      },
    },
    post: {
      tags: ['Contacts'],
      summary: 'Create contact',
      operationId: 'createContact',
      security: secured,
      requestBody: jsonBody('CreateContactRequest'),
      responses: {
        201: ok('Contact created', data(ref('Contact'))),
        401: unauthorized,
        403: forbidden,
        422: validationFailed,
        429: rateLimited,
        500: serverError,
      },
    },
  },
  '/api/v1/contacts/{id}': {
    get: {
      tags: ['Contacts'],
      summary: 'Get contact',
      operationId: 'getContact',
      security: secured,
      parameters: [idParam],
      responses: {
        200: ok('Contact', data(ref('Contact'))),
        401: unauthorized,
        404: notFound('Contact'),
        429: rateLimited,
        500: serverError,
      },
    },
    patch: {
      tags: ['Contacts'],
      summary: 'Update contact',
      operationId: 'updateContact',
      security: secured,
      parameters: [idParam],
      requestBody: jsonBody('UpdateContactRequest'),
      responses: {
        200: ok('Contact updated', data(ref('Contact'))),
        401: unauthorized,
        403: forbidden,
        404: notFound('Contact'),
        422: validationFailed,
        429: rateLimited,
        500: serverError,
      },
    },
    delete: {
      tags: ['Contacts'],
      summary: 'Soft delete contact',
      operationId: 'deleteContact',
      security: secured,
      parameters: [idParam],
      responses: {
        204: noContent,
        401: unauthorized,
        403: forbidden,
        404: notFound('Contact'),
        429: rateLimited,
        500: serverError,
      },
    },
  },
  '/api/v1/leads': {
    get: {
      tags: ['Leads'],
      summary: 'List leads',
      operationId: 'listLeads',
      security: secured,
      parameters: [
        limitParam,
        afterParam,
        query('status', 'Filter by status', {
          type: 'string',
          enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'DISQUALIFIED'],
        }),
      ],
      responses: {
        200: ok('Cursor-paginated leads', page('Lead')),
        422: validationFailed,
        429: rateLimited,
        500: serverError,
      },
    },
    post: {
      tags: ['Leads'],
      summary: 'Create lead',
      operationId: 'createLead',
      security: secured,
      requestBody: jsonBody('CreateLeadRequest'),
      responses: {
        201: ok('Lead created', data(ref('Lead'))),
        401: unauthorized,
        403: forbidden,
        422: validationFailed,
        429: rateLimited,
        500: serverError,
      },
    },
  },
  '/api/v1/leads/{id}': {
    get: {
      tags: ['Leads'],
      summary: 'Get lead',
      operationId: 'getLead',
      security: secured,
      parameters: [idParam],
      responses: {
        200: ok('Lead', data(ref('Lead'))),
        401: unauthorized,
        404: notFound('Lead'),
        429: rateLimited,
        500: serverError,
      },
    },
    patch: {
      tags: ['Leads'],
      summary: 'Update lead',
      operationId: 'updateLead',
      security: secured,
      parameters: [idParam],
      requestBody: jsonBody('UpdateLeadRequest'),
      responses: {
        200: ok('Lead updated', data(ref('Lead'))),
        401: unauthorized,
        403: forbidden,
        404: notFound('Lead'),
        422: validationFailed,
        429: rateLimited,
        500: serverError,
      },
    },
    delete: {
      tags: ['Leads'],
      summary: 'Soft delete lead',
      operationId: 'deleteLead',
      security: secured,
      parameters: [idParam],
      responses: {
        204: noContent,
        401: unauthorized,
        403: forbidden,
        404: notFound('Lead'),
        429: rateLimited,
        500: serverError,
      },
    },
  },
  '/api/v1/leads/{id}/qualify': {
    post: {
      tags: ['Leads'],
      summary: 'Advance a lead to QUALIFIED',
      description:
        'Walks the lead through CONTACTED -> QUALIFIED in one call. No-op when already QUALIFIED.',
      operationId: 'qualifyLead',
      security: secured,
      parameters: [idParam],
      responses: {
        200: ok('Lead advanced', data(ref('Lead'))),
        401: unauthorized,
        403: forbidden,
        404: notFound('Lead'),
        422: err('Lead status cannot be qualified'),
        429: rateLimited,
        500: serverError,
      },
    },
  },
  '/api/v1/leads/{id}/convert': {
    post: {
      tags: ['Leads'],
      summary: 'Convert a qualified lead into company, contact and deal',
      operationId: 'convertLead',
      security: secured,
      parameters: [idParam],
      requestBody: {
        ...jsonBody('ConvertLeadRequest'),
        required: false,
      },
      responses: {
        201: ok('Lead converted', data(ref('ConversionResult'))),
        401: unauthorized,
        403: forbidden,
        404: notFound('Lead'),
        409: err('Lead is already converted or disqualified'),
        422: err('Lead must be QUALIFIED to convert'),
        429: rateLimited,
        500: serverError,
      },
    },
  },
  '/api/v1/deals': {
    get: {
      tags: ['Deals'],
      summary: 'List deals',
      operationId: 'listDeals',
      security: secured,
      parameters: [
        limitParam,
        afterParam,
        query('stage', 'Filter by pipeline stage', {
          type: 'string',
          enum: ['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'],
        }),
      ],
      responses: {
        200: ok('Cursor-paginated deals', page('Deal')),
        422: validationFailed,
        429: rateLimited,
        500: serverError,
      },
    },
    post: {
      tags: ['Deals'],
      summary: 'Create deal',
      operationId: 'createDeal',
      security: secured,
      requestBody: jsonBody('CreateDealRequest'),
      responses: {
        201: ok('Deal created', data(ref('Deal'))),
        401: unauthorized,
        403: forbidden,
        422: validationFailed,
        429: rateLimited,
        500: serverError,
      },
    },
  },
  '/api/v1/deals/{id}': {
    get: {
      tags: ['Deals'],
      summary: 'Get deal',
      operationId: 'getDeal',
      security: secured,
      parameters: [idParam],
      responses: {
        200: ok('Deal', data(ref('Deal'))),
        401: unauthorized,
        404: notFound('Deal'),
        429: rateLimited,
        500: serverError,
      },
    },
    patch: {
      tags: ['Deals'],
      summary: 'Update deal',
      operationId: 'updateDeal',
      security: secured,
      parameters: [idParam],
      requestBody: jsonBody('UpdateDealRequest'),
      responses: {
        200: ok('Deal updated', data(ref('Deal'))),
        401: unauthorized,
        403: forbidden,
        404: notFound('Deal'),
        422: validationFailed,
        409: err('Deal was modified concurrently; retry'),
        429: rateLimited,
        500: serverError,
      },
    },
    delete: {
      tags: ['Deals'],
      summary: 'Soft delete deal',
      operationId: 'deleteDeal',
      security: secured,
      parameters: [idParam],
      responses: {
        204: noContent,
        401: unauthorized,
        403: forbidden,
        404: notFound('Deal'),
        429: rateLimited,
        500: serverError,
      },
    },
  },
  '/api/v1/deals/{id}/advance': {
    post: {
      tags: ['Deals'],
      summary: 'Advance a deal to the next stage',
      operationId: 'advanceDeal',
      security: secured,
      parameters: [idParam],
      requestBody: jsonBody('AdvanceDealRequest'),
      responses: {
        200: ok('Deal advanced', data(ref('Deal'))),
        401: unauthorized,
        403: forbidden,
        404: notFound('Deal'),
        409: err('Deal is already in that stage'),
        422: err('Invalid stage transition'),
        429: rateLimited,
        500: serverError,
      },
    },
  },
  '/api/v1/deals/{id}/win': {
    post: {
      tags: ['Deals'],
      summary: 'Mark a deal as won (only from NEGOTIATION)',
      operationId: 'winDeal',
      security: secured,
      parameters: [idParam],
      responses: {
        200: ok('Deal won', data(ref('Deal'))),
        401: unauthorized,
        403: forbidden,
        404: notFound('Deal'),
        409: err('Deal was modified concurrently; retry'),
        422: err('Deal cannot be won from its current stage'),
        429: rateLimited,
        500: serverError,
      },
    },
  },
  '/api/v1/deals/{id}/lose': {
    post: {
      tags: ['Deals'],
      summary: 'Mark a deal as lost (only from NEGOTIATION)',
      operationId: 'loseDeal',
      security: secured,
      parameters: [idParam],
      responses: {
        200: ok('Deal lost', data(ref('Deal'))),
        401: unauthorized,
        403: forbidden,
        404: notFound('Deal'),
        409: err('Deal was modified concurrently; retry'),
        422: err('Deal cannot be lost from its current stage'),
        429: rateLimited,
        500: serverError,
      },
    },
  },
  '/api/v1/imports': {
    post: {
      tags: ['Imports'],
      summary: 'Start an import',
      operationId: 'createImport',
      security: secured,
      requestBody: jsonBody('CreateImportRequest'),
      responses: {
        202: ok('Import accepted', data(ref('ImportAccepted'))),
        401: unauthorized,
        403: forbidden,
        422: validationFailed,
        429: rateLimited,
        500: serverError,
      },
    },
  },
  '/api/v1/imports/{id}': {
    get: {
      tags: ['Imports'],
      summary: 'Get import status',
      operationId: 'getImport',
      security: secured,
      parameters: [idParam],
      responses: {
        200: ok('Import status', data(ref('ImportJob'))),
        401: unauthorized,
        404: notFound('Import'),
        429: rateLimited,
        500: serverError,
      },
    },
  },
  '/api/v1/exports': {
    post: {
      tags: ['Exports'],
      summary: 'Start an export',
      operationId: 'createExport',
      security: secured,
      requestBody: jsonBody('CreateExportRequest'),
      responses: {
        202: ok('Export accepted', data(ref('ExportJob'))),
        401: unauthorized,
        403: forbidden,
        422: validationFailed,
        429: rateLimited,
        500: serverError,
      },
    },
  },
  '/api/v1/exports/{id}': {
    get: {
      tags: ['Exports'],
      summary: 'Get export status',
      operationId: 'getExport',
      security: secured,
      parameters: [idParam],
      responses: {
        200: ok('Export status', data(ref('ExportJob'))),
        401: unauthorized,
        404: notFound('Export'),
        429: rateLimited,
        500: serverError,
      },
    },
  },
  '/api/v1/exports/{id}/download': {
    get: {
      tags: ['Exports'],
      summary: 'Download a completed export as CSV',
      operationId: 'downloadExport',
      security: secured,
      parameters: [idParam],
      responses: {
        200: {
          description: 'CSV file',
          content: { 'text/csv': { schema: str } },
        },
        401: unauthorized,
        404: notFound('Export file'),
        409: err('Export is not ready for download'),
        429: rateLimited,
        500: serverError,
      },
    },
  },
  '/': {
    get: {
      tags: ['System'],
      summary: 'Service info',
      operationId: 'getServiceInfo',
      responses: {
        200: ok('Service info', ref('ServiceInfo')),
        429: rateLimited,
        500: serverError,
      },
    },
  },
  '/health': {
    get: {
      tags: ['System'],
      summary: 'Liveness probe',
      operationId: 'getHealth',
      responses: {
        200: ok('Service is alive', ref('Health')),
        500: serverError,
      },
    },
  },
  '/ready': {
    get: {
      tags: ['System'],
      summary: 'Readiness probe (database and redis)',
      operationId: 'getReadiness',
      responses: {
        200: ok('All dependencies healthy', ref('Readiness')),
        503: json('A dependency is unavailable', ref('Readiness')),
      },
    },
  },
  '/metrics': {
    get: {
      tags: ['System'],
      summary: 'Process metrics',
      operationId: 'getMetrics',
      responses: {
        200: ok('Process metrics', ref('Metrics')),
        500: serverError,
      },
    },
  },
}

const document: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Essential CRM API',
    version: '0.1.0',
    description: [
      'Multi-tenant CRM REST API.',
      '',
      '**Auth:** session cookie (`session`) issued by `POST /api/v1/auth/register` or `POST /api/v1/auth/login`.',
      '',
      '**Errors:** `{ "error": { code, message, requestId, details? } }` — VALIDATION_ERROR (422), UNAUTHORIZED (401), FORBIDDEN (403), NOT_FOUND (404), CONFLICT (409), OPTIMISTIC_LOCK_CONFLICT (409), RATE_LIMITED (429), INTERNAL_ERROR (500).',
      '',
      '**Pagination:** cursor based — pass `pagination.nextCursor` as `?after=`; `pagination.hasNextPage` signals more pages.',
      '',
      '**Interactive docs:** `/docs`',
    ].join('\n'),
  },
  tags: [
    { name: 'Auth', description: 'Authentication' },
    { name: 'Companies', description: 'Customers' },
    { name: 'Contacts', description: 'Contact people' },
    { name: 'Leads', description: 'Lead pipeline' },
    { name: 'Deals', description: 'Sales deals' },
    { name: 'Imports', description: 'CSV imports' },
    { name: 'Exports', description: 'CSV exports' },
    { name: 'System', description: 'Health and metrics' },
  ],
  paths,
  components: {
    securitySchemes: { sessionCookie: SESSION_COOKIE },
    schemas,
  },
}

export const openapi: SwaggerOptions = {
  mode: 'static',
  specification: { document },
}
