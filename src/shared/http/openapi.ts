import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import type { FastifyInstance } from 'fastify'

type SwaggerOptions = Extract<
  Parameters<typeof swagger>[1],
  { openapi?: unknown }
>
type Json = Record<string, unknown>
type SchemasMap = NonNullable<
  NonNullable<NonNullable<SwaggerOptions['openapi']>['components']>['schemas']
>
type SchemaObject = Exclude<SchemasMap[string], { $ref: string }>

const str: Json = { type: 'string' }
const nullable = (schema: Json): Json => ({ ...schema, nullable: true })
const num: Json = { type: 'number' }
const int: Json = { type: 'integer' }
const bool: Json = { type: 'boolean' }
const date: Json = { type: 'string', format: 'date-time' }
const ndate = nullable(date)
const timestampColumns = {
  created_at: date,
  updated_at: date,
  deleted_at: ndate,
}

const ref = (name: string): Json => ({ $ref: `#/components/schemas/${name}` })
const links: Json = { type: 'object', additionalProperties: ref('Link') }

const json = (description: string, schema: Json): Json => ({
  description,
  content: { 'application/json': { schema } },
})
const noContent: Json = { description: 'No content' }
const err = (description: string): Json => json(description, ref('Error'))
const data = (schema: Json): Json => ({
  type: 'object',
  required: ['data'],
  properties: { data: schema, _links: links },
})
const paged = (item: string): Json => ({
  type: 'object',
  required: ['data', 'pagination'],
  properties: {
    data: { type: 'array', items: ref(item) },
    pagination: ref('Pagination'),
    _links: links,
  },
})

const forbidden: Json = err('Forbidden: requires OWNER or ADMIN role')
const conflict: Json = err(
  'Conflict: resource state does not allow this action',
)

const authData = () => data(ref('AuthSessionData'))

class OpenApiDocumentFactory {
  build(): SwaggerOptions {
    return {
      openapi: {
        openapi: '3.0.3',
        info: {
          title: 'Essential CRM API',
          version: '0.1.0',
          description: [
            'Multi-tenant CRM REST API.',
            '',
            '**Auth:** session cookie (`session`) issued by `POST /api/v1/auth/register` or `POST /api/v1/auth/login`.',
            '',
            '**Errors:** `{ "error": { code, message, requestId, details? } }` — VALIDATION_ERROR (422), UNAUTHORIZED (401), FORBIDDEN (403), NOT_FOUND (404), CONFLICT (409), RATE_LIMITED (429), INTERNAL_ERROR (500).',
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
        ],
        components: {
          securitySchemes: {
            sessionCookie: {
              type: 'apiKey',
              in: 'cookie',
              name: 'session',
              description:
                'Session cookie issued by /auth/register and /auth/login',
            },
          },
          schemas: this.schemas() as Record<string, SchemaObject>,
        },
      },
      transformObject: (documentObject) => this.enrich(documentObject),
    }
  }

  private schemas(): Json {
    return {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message', 'requestId'],
            properties: {
              code: { ...str, example: 'UNAUTHORIZED' },
              message: str,
              requestId: str,
              details: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
      Link: {
        type: 'object',
        required: ['href'],
        properties: { href: str, method: str },
      },
      Pagination: {
        type: 'object',
        required: ['limit', 'hasNextPage', 'nextCursor'],
        properties: {
          limit: int,
          hasNextPage: bool,
          nextCursor: nullable(str),
        },
      },
      AuthUser: {
        type: 'object',
        required: ['id', 'email', 'name'],
        properties: {
          id: str,
          email: { type: 'string', format: 'email' },
          name: str,
        },
      },
      OrganizationSummary: {
        type: 'object',
        required: ['id', 'name', 'slug'],
        properties: { id: str, name: str, slug: str },
      },
      AuthSessionData: {
        type: 'object',
        required: ['user', 'organization'],
        properties: {
          user: ref('AuthUser'),
          organization: ref('OrganizationSummary'),
        },
      },
      MeData: {
        type: 'object',
        required: ['user'],
        properties: {
          user: ref('AuthUser'),
          organization: {
            nullable: true,
            allOf: [ref('OrganizationSummary')],
          },
          role: {
            type: 'string',
            enum: ['OWNER', 'ADMIN', 'MEMBER'],
            nullable: true,
          },
        },
      },
      Company: {
        type: 'object',
        required: ['id', 'organization_id', 'name'],
        properties: {
          id: str,
          organization_id: str,
          name: str,
          domain: nullable(str),
          industry: nullable(str),
          size: nullable(str),
          website: nullable(str),
          notes: nullable(str),
          ...timestampColumns,
          _links: links,
        },
      },
      Contact: {
        type: 'object',
        required: ['id', 'organization_id', 'email'],
        properties: {
          id: str,
          organization_id: str,
          company_id: nullable(str),
          email: { type: 'string', format: 'email' },
          firstName: str,
          lastName: str,
          phone: nullable(str),
          title: nullable(str),
          notes: nullable(str),
          ...timestampColumns,
          _links: links,
        },
      },
      Lead: {
        type: 'object',
        required: ['id', 'organization_id', 'email', 'status'],
        properties: {
          id: str,
          organization_id: str,
          companyId: nullable(str),
          contactId: nullable(str),
          email: { type: 'string', format: 'email' },
          firstName: str,
          lastName: str,
          company: nullable(str),
          source: nullable(str),
          status: {
            type: 'string',
            enum: [
              'NEW',
              'CONTACTED',
              'QUALIFIED',
              'CONVERTED',
              'DISQUALIFIED',
            ],
          },
          convertedDealId: nullable(str),
          notes: nullable(str),
          version: int,
          ...timestampColumns,
          _links: links,
        },
      },
      Deal: {
        type: 'object',
        required: ['id', 'organization_id', 'title', 'stage'],
        properties: {
          id: str,
          organization_id: str,
          companyId: nullable(str),
          contactId: nullable(str),
          leadId: nullable(str),
          title: str,
          value: nullable(num),
          currency: str,
          stage: {
            type: 'string',
            enum: [
              'NEW',
              'QUALIFIED',
              'PROPOSAL',
              'NEGOTIATION',
              'WON',
              'LOST',
            ],
          },
          expectedCloseDate: ndate,
          notes: nullable(str),
          version: int,
          ...timestampColumns,
          _links: links,
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
      ImportJob: {
        type: 'object',
        required: ['id', 'type', 'status'],
        properties: {
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
          file_path: nullable(str),
          error_message: nullable(str),
          ...timestampColumns,
          _links: links,
        },
      },
      ImportAccepted: {
        type: 'object',
        required: ['id', 'status', 'type'],
        properties: { id: str, status: str, type: str, _links: links },
      },
      ExportJob: {
        type: 'object',
        required: ['id', 'type', 'status'],
        properties: {
          id: str,
          organization_id: str,
          actor_id: str,
          type: { type: 'string', enum: ['companies', 'contacts', 'leads'] },
          status: {
            type: 'string',
            enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
          },
          file_path: nullable(str),
          download_url: nullable(str),
          error_message: nullable(str),
          ...timestampColumns,
          _links: links,
        },
      },
    }
  }

  private routes(): Record<string, Json> {
    return {
      'POST /api/v1/auth/register': {
        '201': json('Organization, owner and session created', authData()),
        '409': err('Conflict: email already registered'),
      },
      'POST /api/v1/auth/login': {
        '200': json('Authenticated; session cookie set', authData()),
        '401': err('Invalid email or password'),
      },
      'POST /api/v1/auth/password/change': {
        '200': json(
          'Password updated; other sessions revoked',
          data({ type: 'object', properties: { message: str } }),
        ),
        '401': err('Current password incorrect'),
      },
      'POST /api/v1/auth/logout': { '204': noContent },
      'GET /api/v1/auth/me': {
        '200': json('Current user, organization and role', data(ref('MeData'))),
      },
      'GET /api/v1/companies': {
        '200': json('Cursor-paginated companies', paged('Company')),
      },
      'GET /api/v1/companies/{id}': {
        '200': json('Company', data(ref('Company'))),
      },
      'POST /api/v1/companies': {
        '201': json('Company created', data(ref('Company'))),
        '403': forbidden,
      },
      'PATCH /api/v1/companies/{id}': {
        '200': json('Company updated', data(ref('Company'))),
        '403': forbidden,
      },
      'DELETE /api/v1/companies/{id}': {
        '204': noContent,
        '403': forbidden,
      },
      'GET /api/v1/contacts': {
        '200': json('Cursor-paginated contacts', paged('Contact')),
      },
      'GET /api/v1/contacts/{id}': {
        '200': json('Contact', data(ref('Contact'))),
      },
      'POST /api/v1/contacts': {
        '201': json('Contact created', data(ref('Contact'))),
        '403': forbidden,
      },
      'PATCH /api/v1/contacts/{id}': {
        '200': json('Contact updated', data(ref('Contact'))),
        '403': forbidden,
      },
      'DELETE /api/v1/contacts/{id}': {
        '204': noContent,
        '403': forbidden,
      },
      'GET /api/v1/leads': {
        '200': json('Cursor-paginated leads', paged('Lead')),
      },
      'GET /api/v1/leads/{id}': { '200': json('Lead', data(ref('Lead'))) },
      'POST /api/v1/leads': {
        '201': json('Lead created', data(ref('Lead'))),
        '403': forbidden,
      },
      'PATCH /api/v1/leads/{id}': {
        '200': json('Lead updated', data(ref('Lead'))),
        '403': forbidden,
      },
      'DELETE /api/v1/leads/{id}': {
        '204': noContent,
        '403': forbidden,
      },
      'POST /api/v1/leads/{id}/qualify': {
        '200': json('Lead advanced to the next status', data(ref('Lead'))),
        '403': forbidden,
      },
      'POST /api/v1/leads/{id}/convert': {
        '201': json(
          'Lead converted into company, contact and deal',
          data(ref('ConversionResult')),
        ),
        '403': forbidden,
        '409': conflict,
      },
      'GET /api/v1/deals': {
        '200': json('Cursor-paginated deals', paged('Deal')),
      },
      'GET /api/v1/deals/{id}': { '200': json('Deal', data(ref('Deal'))) },
      'POST /api/v1/deals': {
        '201': json('Deal created', data(ref('Deal'))),
        '403': forbidden,
      },
      'PATCH /api/v1/deals/{id}': {
        '200': json('Deal updated', data(ref('Deal'))),
        '403': forbidden,
      },
      'DELETE /api/v1/deals/{id}': {
        '204': noContent,
        '403': forbidden,
      },
      'POST /api/v1/deals/{id}/advance': {
        '200': json('Deal advanced to a later stage', data(ref('Deal'))),
        '403': forbidden,
        '409': conflict,
      },
      'POST /api/v1/deals/{id}/win': {
        '200': json('Deal won', data(ref('Deal'))),
        '403': forbidden,
        '409': conflict,
      },
      'POST /api/v1/deals/{id}/lose': {
        '200': json('Deal lost', data(ref('Deal'))),
        '403': forbidden,
        '409': conflict,
      },
      'POST /api/v1/imports': {
        '202': json('Import accepted', data(ref('ImportAccepted'))),
        '403': forbidden,
      },
      'GET /api/v1/imports/{id}': {
        '200': json('Import status', data(ref('ImportJob'))),
      },
      'POST /api/v1/exports': {
        '202': json('Export accepted', data(ref('ExportJob'))),
        '403': forbidden,
      },
      'GET /api/v1/exports/{id}': {
        '200': json('Export status', data(ref('ExportJob'))),
      },
      'GET /api/v1/exports/{id}/download': {
        '200': {
          description: 'CSV file',
          content: { 'text/csv': { schema: { type: 'string' } } },
        },
        '409': err('Export is not ready for download'),
      },
      'GET /': {
        '200': json('Service info', {
          type: 'object',
          properties: { status: str, name: str, docs: str, health: str },
        }),
      },
      'GET /health': {
        '200': json('Liveness', {
          type: 'object',
          properties: { status: str, timestamp: str },
        }),
      },
      'GET /ready': {
        '200': json('Ready', {
          type: 'object',
          properties: {
            status: str,
            checks: { type: 'object', additionalProperties: str },
            timestamp: str,
          },
        }),
        '503': json('Degraded', {
          type: 'object',
          properties: {
            status: str,
            checks: { type: 'object', additionalProperties: str },
            timestamp: str,
          },
        }),
      },
      'GET /metrics': {
        '200': json('Process metrics', {
          type: 'object',
          properties: {
            uptime: num,
            memory: { type: 'object', additionalProperties: num },
            timestamp: str,
          },
        }),
      },
    }
  }

  private enrich(
    documentObject: Parameters<
      NonNullable<SwaggerOptions['transformObject']>
    >[0],
  ): ReturnType<NonNullable<SwaggerOptions['transformObject']>> {
    const routes = this.routes()
    if (!('openapiObject' in documentObject)) return {}
    const openapiObject = documentObject.openapiObject
    const doc = openapiObject as {
      paths?: Record<string, Record<string, unknown> | undefined>
    }
    for (const [path, item] of Object.entries(doc.paths ?? {})) {
      if (!item) continue
      for (const method of ['get', 'post', 'patch', 'put', 'delete']) {
        const operation = item[method]
        if (!operation || typeof operation !== 'object') continue
        const op = operation as {
          tags?: string[]
          responses?: Record<string, unknown>
        }
        const responses = (op.responses ??= {})
        const route = routes[`${method.toUpperCase()} ${path}`]
        if (route) Object.assign(responses, route)
        if (!op.tags || op.tags.length === 0) continue
        const add = (code: string, response: Json) => {
          if (!responses[code]) responses[code] = response
        }
        add('401', err('Authentication required'))
        add('422', err('Validation failed'))
        add('429', err('Rate limit exceeded'))
        add('500', err('Internal server error'))
        if (path.includes('{id}')) add('404', err('Resource not found'))
      }
    }
    return openapiObject
  }
}

export const openapi: SwaggerOptions = new OpenApiDocumentFactory().build()

export class OpenApiPlugin {
  async register(app: FastifyInstance): Promise<void> {
    await app.register(swagger, openapi)
    await app.register(swaggerUi, { routePrefix: '/docs' })
    app.addHook('onSend', async (request, reply) => {
      if (request.url.startsWith('/docs')) {
        reply.removeHeader('content-security-policy')
        reply.removeHeader('cross-origin-embedder-policy')
      }
    })
  }
}
