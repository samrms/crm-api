import type swagger from '@fastify/swagger'
import type { OpenAPIV3 } from 'openapi-types'
import { SESSION_COOKIE } from './helpers.js'
import { schemas } from './schemas.js'
import { paths } from './paths.js'

type SwaggerOptions = Extract<
  Parameters<typeof swagger>[1],
  { mode?: 'static' }
>

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
