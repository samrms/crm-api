import type { OpenAPIV3 } from 'openapi-types'

export type Schema = OpenAPIV3.SchemaObject
export type SchemaLike = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject

export const SESSION_COOKIE: OpenAPIV3.SecuritySchemeObject = {
  type: 'apiKey',
  in: 'cookie',
  name: 'session',
  description: 'Session cookie issued by /api/v1/auth/register or /login',
}
export const secured: OpenAPIV3.SecurityRequirementObject[] = [
  { sessionCookie: [] },
]

export const str: Schema = { type: 'string' }
export const nullableStr: Schema = { type: 'string', nullable: true }
export const int: Schema = { type: 'integer' }
export const num: Schema = { type: 'number' }
export const bool: Schema = { type: 'boolean' }
export const dateTime: Schema = { type: 'string', format: 'date-time' }
export const nullableDateTime: Schema = {
  type: 'string',
  format: 'date-time',
  nullable: true,
}
export const email: Schema = { type: 'string', format: 'email' }

export const ref = (name: string): SchemaLike => ({
  $ref: `#/components/schemas/${name}`,
})
export const timestamps = {
  created_at: dateTime,
  updated_at: dateTime,
  deleted_at: nullableDateTime,
}
export const entity = (properties: Record<string, Schema>): Schema => ({
  type: 'object',
  properties: { ...properties, ...timestamps },
})

export const json = (
  description: string,
  schema: SchemaLike,
): OpenAPIV3.ResponseObject => ({
  description,
  content: { 'application/json': { schema } },
})
export const err = (description: string): OpenAPIV3.ResponseObject =>
  json(description, ref('Error'))
export const ok = (
  description: string,
  schema: SchemaLike,
): OpenAPIV3.ResponseObject => json(description, schema)
export const data = (schema: SchemaLike): Schema => ({
  type: 'object',
  required: ['data'],
  properties: { data: schema },
})
export const page = (item: string): Schema => ({
  type: 'object',
  required: ['data', 'pagination'],
  properties: {
    data: { type: 'array', items: ref(item) },
    pagination: ref('Pagination'),
  },
})

export const jsonBody = (schemaName: string): OpenAPIV3.RequestBodyObject => ({
  required: true,
  content: { 'application/json': { schema: ref(schemaName) } },
})
export const idParam: OpenAPIV3.ParameterObject = {
  name: 'id',
  in: 'path',
  required: true,
  description: 'Resource id',
  schema: str,
}
export const query = (
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
export const limitParam = query('limit', 'Page size (1-100, default 25)', int)
export const afterParam = query(
  'after',
  'Cursor from a previous response `pagination.nextCursor`',
)

export const noContent: OpenAPIV3.ResponseObject = { description: 'No content' }
export const unauthorized = err('Authentication required')
export const forbidden = err('Forbidden: requires OWNER or ADMIN role')
export const notFound = (resource: string) => err(`${resource} not found`)
export const validationFailed = err('Validation failed')
export const rateLimited = err('Rate limit exceeded')
export const serverError = err('Internal server error')
