import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  startTestDatabase,
  stopTestDatabase,
  getTestDb,
} from '../fixtures/testDatabase.js'
import {
  createTestOrganization,
  createTestUser,
} from '../fixtures/factories.js'
import { ImportService } from '../../src/modules/bulk/imports/application/ImportService.js'
import { PostgresImportRepository } from '../../src/modules/bulk/imports/infrastructure/PostgresImportRepository.js'
import { ExportService } from '../../src/modules/bulk/exports/application/ExportService.js'
import { PostgresExportRepository } from '../../src/modules/bulk/exports/infrastructure/PostgresExportRepository.js'

describe('Integration: Import/Export services', () => {
  beforeAll(async () => {
    await startTestDatabase()
  })

  afterAll(async () => {
    await stopTestDatabase()
  })

  it('createImport persists the import row and its outbox event', async () => {
    const org = await createTestOrganization()
    const user = await createTestUser()
    const db = getTestDb()
    const svc = new ImportService(db, new PostgresImportRepository(db))

    const imp = await svc.createImport({
      organizationId: org.id,
      actorId: user.id,
      type: 'companies',
      filePath: '/tmp/import.csv',
    })

    expect(imp.status).toBe('PENDING')

    const rows = await db
      .selectFrom('imports')
      .selectAll()
      .where('id', '=', imp.id)
      .execute()
    expect(rows).toHaveLength(1)

    const outbox = await db
      .selectFrom('outbox_events')
      .selectAll()
      .where('type', '=', 'IMPORT_CREATED')
      .where('organization_id', '=', org.id)
      .execute()
    expect(outbox).toHaveLength(1)
    expect(JSON.parse(String(outbox[0].payload))).toMatchObject({
      importId: imp.id,
    })
  })

  it('createExport persists the export row and its outbox event', async () => {
    const org = await createTestOrganization()
    const user = await createTestUser()
    const db = getTestDb()
    const svc = new ExportService(db, new PostgresExportRepository(db))

    const exp = await svc.createExport({
      organizationId: org.id,
      actorId: user.id,
      type: 'deals',
    })

    expect(exp.status).toBe('PENDING')

    const rows = await db
      .selectFrom('exports')
      .selectAll()
      .where('id', '=', exp.id)
      .execute()
    expect(rows).toHaveLength(1)

    const outbox = await db
      .selectFrom('outbox_events')
      .selectAll()
      .where('type', '=', 'EXPORT_CREATED')
      .where('organization_id', '=', org.id)
      .execute()
    expect(outbox).toHaveLength(1)
    expect(JSON.parse(String(outbox[0].payload))).toMatchObject({
      exportId: exp.id,
    })
  })
})
