import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../src/app.js'
import {
  startTestDatabase,
  stopTestDatabase,
  getTestDb,
} from '../fixtures/testDatabase.js'
import {
  createTestOrganization,
  createTestUser,
  createTestMembership,
  createTestSession,
  createTestCompany,
  cleanupTestData,
} from '../fixtures/factories.js'
import { processImport } from '../../src/modules/bulk/imports/application/processImport.js'
import { processExport } from '../../src/modules/bulk/exports/application/processExport.js'

const TMP_ROOT = '/tmp/opencode'

let app: FastifyInstance
let storageDir: string
let sessionToken: string
let organizationId: string

describe('API: Bulk import/export', () => {
  beforeAll(async () => {
    await startTestDatabase()
    await mkdir(TMP_ROOT, { recursive: true })
    storageDir = await mkdtemp(join(TMP_ROOT, 'crm-api-bulk-'))
    app = await buildApp({ storageDir })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await stopTestDatabase()
    await rm(storageDir, { recursive: true, force: true })
  })

  beforeEach(async () => {
    await cleanupTestData()
    const org = await createTestOrganization()
    const user = await createTestUser()
    await createTestMembership({ userId: user.id, organizationId: org.id })
    const { token } = await createTestSession(user.id, org.id)
    organizationId = org.id
    sessionToken = token
  })

  /** Drain the queue synchronously, standing in for the worker process. */
  async function drainImport(importId: string, type: string) {
    const db = getTestDb()
    const [row] = await db
      .selectFrom('imports')
      .selectAll()
      .where('id', '=', importId)
      .execute()
    return processImport(db, {
      importId,
      organizationId,
      type,
      filePath: row!.file_path!,
    })
  }

  async function drainExport(exportId: string, type: string) {
    return processExport(
      getTestDb(),
      { exportId, organizationId, type },
      { storageDir },
    )
  }

  it('accepts CSV content, queues the import, then reports real progress', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/imports',
      payload: {
        type: 'companies',
        content: 'name,domain\nAcme,acme.com\nBeta,beta.io\n',
      },
      cookies: { session: sessionToken },
    })
    expect(createRes.statusCode).toBe(202)
    const created = JSON.parse(createRes.payload).data
    expect(created.status).toBe('PENDING')

    await drainImport(created.id, 'companies')

    const statusRes = await app.inject({
      method: 'GET',
      url: `/api/v1/imports/${created.id}`,
      cookies: { session: sessionToken },
    })
    expect(statusRes.statusCode).toBe(200)

    const body = JSON.parse(statusRes.payload).data
    expect(body.status).toBe('COMPLETED')
    expect(body.total).toBe(2)
    expect(body.successful).toBe(2)
    expect(body.failed).toBe(0)

    const companies = await getTestDb()
      .selectFrom('companies')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .execute()
    expect(companies).toHaveLength(2)
  })

  it('rejects inline CSV above the size cap with a 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/imports',
      payload: { type: 'companies', content: 'a'.repeat(900_001) },
      cookies: { session: sessionToken },
    })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.payload).error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects an unsupported import type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/imports',
      payload: { type: 'deals' },
      cookies: { session: sessionToken },
    })
    expect(res.statusCode).toBe(422)
  })

  it('refuses to download an export that has not finished', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/exports',
      payload: { type: 'companies' },
      cookies: { session: sessionToken },
    })
    expect(createRes.statusCode).toBe(202)
    const created = JSON.parse(createRes.payload).data

    const downloadRes = await app.inject({
      method: 'GET',
      url: `/api/v1/exports/${created.id}/download`,
      cookies: { session: sessionToken },
    })
    expect(downloadRes.statusCode).toBe(409)
    expect(JSON.parse(downloadRes.payload).error.code).toBe('CONFLICT')
  })

  it('completes an export and serves the generated CSV', async () => {
    await createTestCompany(organizationId, { name: 'Downloadable Co' })

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/exports',
      payload: { type: 'companies' },
      cookies: { session: sessionToken },
    })
    const created = JSON.parse(createRes.payload).data

    await drainExport(created.id, 'companies')

    const statusRes = await app.inject({
      method: 'GET',
      url: `/api/v1/exports/${created.id}`,
      cookies: { session: sessionToken },
    })
    const body = JSON.parse(statusRes.payload)
    expect(body.data.status).toBe('COMPLETED')
    expect(body._links.download.href).toBe(
      `/api/v1/exports/${created.id}/download`,
    )

    const downloadRes = await app.inject({
      method: 'GET',
      url: `/api/v1/exports/${created.id}/download`,
      cookies: { session: sessionToken },
    })
    expect(downloadRes.statusCode).toBe(200)
    expect(downloadRes.headers['content-type']).toContain('text/csv')
    expect(downloadRes.headers['content-disposition']).toContain(
      `filename="companies-${created.id}.csv"`,
    )
    expect(downloadRes.body).toContain('Downloadable Co')
  })

  it("hides another organization's export behind a 404", async () => {
    const otherOrg = await createTestOrganization()
    const otherUser = await createTestUser()
    await createTestMembership({
      userId: otherUser.id,
      organizationId: otherOrg.id,
    })
    const { token: otherToken } = await createTestSession(
      otherUser.id,
      otherOrg.id,
    )

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/exports',
      payload: { type: 'companies' },
      cookies: { session: sessionToken },
    })
    const created = JSON.parse(createRes.payload).data
    await drainExport(created.id, 'companies')

    const statusRes = await app.inject({
      method: 'GET',
      url: `/api/v1/exports/${created.id}`,
      cookies: { session: otherToken },
    })
    expect(statusRes.statusCode).toBe(404)

    const downloadRes = await app.inject({
      method: 'GET',
      url: `/api/v1/exports/${created.id}/download`,
      cookies: { session: otherToken },
    })
    expect(downloadRes.statusCode).toBe(404)
  })
})
