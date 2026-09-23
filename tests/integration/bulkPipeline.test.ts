import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  startTestDatabase,
  stopTestDatabase,
  getTestDb,
} from '../fixtures/testDatabase.js'
import {
  createTestOrganization,
  createTestUser,
  createTestCompany,
  cleanupTestData,
} from '../fixtures/factories.js'
import { ImportService } from '../../src/modules/bulk/imports/application/ImportService.js'
import { PostgresImportRepository } from '../../src/modules/bulk/imports/infrastructure/PostgresImportRepository.js'
import { ExportService } from '../../src/modules/bulk/exports/application/ExportService.js'
import { PostgresExportRepository } from '../../src/modules/bulk/exports/infrastructure/PostgresExportRepository.js'
import { processImport } from '../../src/modules/bulk/imports/application/processImport.js'
import { processExport } from '../../src/modules/bulk/exports/application/processExport.js'

const TMP_ROOT = '/tmp/opencode'

let storageDir: string

async function makeImport(
  organizationId: string,
  actorId: string,
  type: string,
  csv: string | null,
) {
  const db = getTestDb()
  const filePath = join(
    storageDir,
    `in-${Math.random().toString(36).slice(2)}.csv`,
  )
  if (csv !== null) {
    await writeFile(filePath, csv, 'utf8')
  }
  return new ImportService(db, new PostgresImportRepository(db)).createImport({
    organizationId,
    actorId,
    type,
    filePath,
  })
}

async function loadImport(importId: string) {
  const [row] = await getTestDb()
    .selectFrom('imports')
    .selectAll()
    .where('id', '=', importId)
    .execute()
  return row!
}

describe('Integration: Bulk import/export pipeline', () => {
  beforeAll(async () => {
    await startTestDatabase()
    await mkdir(TMP_ROOT, { recursive: true })
    storageDir = await mkdtemp(join(TMP_ROOT, 'crm-bulk-'))
  })

  afterAll(async () => {
    await stopTestDatabase()
    await rm(storageDir, { recursive: true, force: true })
  })

  beforeEach(async () => {
    await cleanupTestData()
  })

  describe('processImport', () => {
    it('imports valid rows, tenant-scoped, and completes', async () => {
      const db = getTestDb()
      const org = await createTestOrganization()
      const user = await createTestUser()

      const imp = await makeImport(
        org.id,
        user.id,
        'companies',
        'name,domain\nAcme,acme.com\nBeta,\n',
      )

      const result = await processImport(db, {
        importId: imp.id,
        organizationId: org.id,
        type: 'companies',
        filePath: imp.file_path!,
      })

      expect(result).toMatchObject({
        skipped: false,
        total: 2,
        successful: 2,
        failed: 0,
      })

      const stored = await loadImport(imp.id)
      expect(stored.status).toBe('COMPLETED')
      expect(stored.total).toBe(2)
      expect(stored.processed).toBe(2)
      expect(stored.successful).toBe(2)
      expect(stored.failed).toBe(0)

      const companies = await db
        .selectFrom('companies')
        .selectAll()
        .where('organization_id', '=', org.id)
        .execute()
      expect(companies.map((c) => c.name).sort()).toEqual(['Acme', 'Beta'])
      expect(companies[0]!.organization_id).toBe(org.id)
    })

    it('counts row-level failures without aborting the batch', async () => {
      const db = getTestDb()
      const org = await createTestOrganization()
      const user = await createTestUser()

      const imp = await makeImport(
        org.id,
        user.id,
        'contacts',
        'email,firstName,lastName\nann@example.com,Ann,Lee\nnot-an-email,Bob,Lee\n',
      )

      const result = await processImport(db, {
        importId: imp.id,
        organizationId: org.id,
        type: 'contacts',
        filePath: imp.file_path!,
      })

      expect(result).toMatchObject({ successful: 1, failed: 1 })

      const stored = await loadImport(imp.id)
      expect(stored.status).toBe('COMPLETED')
      expect(stored.error_message).toContain('Row 3')

      const contacts = await db
        .selectFrom('contacts')
        .selectAll()
        .where('organization_id', '=', org.id)
        .execute()
      expect(contacts).toHaveLength(1)
      expect(contacts[0]!.email).toBe('ann@example.com')
    })

    it('fails the import when every row is rejected', async () => {
      const db = getTestDb()
      const org = await createTestOrganization()
      const user = await createTestUser()

      const imp = await makeImport(
        org.id,
        user.id,
        'contacts',
        'email,firstName,lastName\nnope,Bob,Lee\n',
      )

      await processImport(db, {
        importId: imp.id,
        organizationId: org.id,
        type: 'contacts',
        filePath: imp.file_path!,
      })

      const stored = await loadImport(imp.id)
      expect(stored.status).toBe('FAILED')
      expect(stored.failed).toBe(1)
      expect(stored.successful).toBe(0)
    })

    it('fails with a clear message when the CSV file is missing', async () => {
      const db = getTestDb()
      const org = await createTestOrganization()
      const user = await createTestUser()

      const imp = await makeImport(org.id, user.id, 'companies', null)

      const result = await processImport(db, {
        importId: imp.id,
        organizationId: org.id,
        type: 'companies',
        filePath: imp.file_path!,
      })

      expect(result).toMatchObject({ total: 0, successful: 0, failed: 0 })
      const stored = await loadImport(imp.id)
      expect(stored.status).toBe('FAILED')
      expect(stored.error_message).toContain('CSV file not found')
    })

    it('rejects columns that are not part of the target shape', async () => {
      const db = getTestDb()
      const org = await createTestOrganization()
      const user = await createTestUser()

      const imp = await makeImport(
        org.id,
        user.id,
        'companies',
        'name,colour\nAcme,red\n',
      )

      await processImport(db, {
        importId: imp.id,
        organizationId: org.id,
        type: 'companies',
        filePath: imp.file_path!,
      })

      const stored = await loadImport(imp.id)
      expect(stored.status).toBe('FAILED')
      expect(stored.error_message).toContain('Unknown column(s): colour')
    })

    it('rejects a CSV missing required columns', async () => {
      const db = getTestDb()
      const org = await createTestOrganization()
      const user = await createTestUser()

      const imp = await makeImport(
        org.id,
        user.id,
        'companies',
        'domain\nacme.com\n',
      )

      await processImport(db, {
        importId: imp.id,
        organizationId: org.id,
        type: 'companies',
        filePath: imp.file_path!,
      })

      const stored = await loadImport(imp.id)
      expect(stored.status).toBe('FAILED')
      expect(stored.error_message).toContain('Missing required column(s): name')
    })

    it('is idempotent when the job is delivered twice', async () => {
      const db = getTestDb()
      const org = await createTestOrganization()
      const user = await createTestUser()

      const imp = await makeImport(org.id, user.id, 'companies', 'name\nAcme\n')
      const job = {
        importId: imp.id,
        organizationId: org.id,
        type: 'companies',
        filePath: imp.file_path!,
      }

      await processImport(db, job)
      const replay = await processImport(db, job)

      expect(replay).toMatchObject({ skipped: true, successful: 1 })

      const companies = await db
        .selectFrom('companies')
        .selectAll()
        .where('organization_id', '=', org.id)
        .execute()
      expect(companies).toHaveLength(1)
    })

    it('cannot reference a company owned by another organization', async () => {
      const db = getTestDb()
      const orgA = await createTestOrganization()
      const orgB = await createTestOrganization()
      const user = await createTestUser()
      const foreign = await createTestCompany(orgB.id, { name: 'Other Org' })

      const imp = await makeImport(
        orgA.id,
        user.id,
        'contacts',
        `email,firstName,lastName,companyId\nintruder@example.com,Eve,Lee,${foreign.id}\n`,
      )

      const result = await processImport(db, {
        importId: imp.id,
        organizationId: orgA.id,
        type: 'contacts',
        filePath: imp.file_path!,
      })

      expect(result).toMatchObject({ successful: 0, failed: 1 })
      const stored = await loadImport(imp.id)
      expect(stored.status).toBe('FAILED')
      expect(stored.error_message).toContain(
        'does not exist in this organization',
      )
    })
  })

  describe('processExport', () => {
    it('writes a tenant-scoped CSV and marks the export complete', async () => {
      const db = getTestDb()
      const orgA = await createTestOrganization()
      const orgB = await createTestOrganization()
      const user = await createTestUser()

      await createTestCompany(orgA.id, { name: 'Visible Company' })
      await createTestCompany(orgB.id, { name: 'Hidden Company' })

      const exp = await new ExportService(
        db,
        new PostgresExportRepository(db),
      ).createExport({
        organizationId: orgA.id,
        actorId: user.id,
        type: 'companies',
      })

      const result = await processExport(
        db,
        { exportId: exp.id, organizationId: orgA.id, type: 'companies' },
        { storageDir },
      )

      expect(result).toMatchObject({
        skipped: false,
        rows: 1,
        downloadUrl: `/api/v1/exports/${exp.id}/download`,
      })

      const csv = await readFile(result.filePath!, 'utf8')
      expect(csv.split('\n')[0]).toContain('id,name')
      expect(csv).toContain('Visible Company')
      expect(csv).not.toContain('Hidden Company')

      const stored = await db
        .selectFrom('exports')
        .selectAll()
        .where('id', '=', exp.id)
        .executeTakeFirstOrThrow()
      expect(stored.status).toBe('COMPLETED')
      expect(stored.file_path).toBe(result.filePath)
      expect(stored.download_url).toBe(result.downloadUrl)
    })

    it('is idempotent when the job is delivered twice', async () => {
      const db = getTestDb()
      const org = await createTestOrganization()
      const user = await createTestUser()
      await createTestCompany(org.id, { name: 'Solo Company' })

      const exp = await new ExportService(
        db,
        new PostgresExportRepository(db),
      ).createExport({
        organizationId: org.id,
        actorId: user.id,
        type: 'companies',
      })

      const job = {
        exportId: exp.id,
        organizationId: org.id,
        type: 'companies',
      }
      const first = await processExport(db, job, { storageDir })
      const replay = await processExport(db, job, { storageDir })

      expect(replay.skipped).toBe(true)
      expect(replay.filePath).toBe(first.filePath)
      expect(replay.rows).toBe(0)
    })

    it('fails exports for an unsupported type', async () => {
      const db = getTestDb()
      const org = await createTestOrganization()
      const user = await createTestUser()

      const exp = await new ExportService(
        db,
        new PostgresExportRepository(db),
      ).createExport({
        organizationId: org.id,
        actorId: user.id,
        type: 'tasks',
      })

      const result = await processExport(
        db,
        { exportId: exp.id, organizationId: org.id, type: 'tasks' },
        { storageDir },
      )
      expect(result).toMatchObject({ skipped: false, rows: 0 })

      const stored = await db
        .selectFrom('exports')
        .selectAll()
        .where('id', '=', exp.id)
        .executeTakeFirstOrThrow()
      expect(stored.status).toBe('FAILED')
      expect(stored.error_message).toContain('Unsupported export type')
    })

    it('escapes commas and quotes when serializing rows', async () => {
      const db = getTestDb()
      const org = await createTestOrganization()
      const user = await createTestUser()
      await createTestCompany(org.id, { name: 'Doe, "Jane" Ltd' })

      const exp = await new ExportService(
        db,
        new PostgresExportRepository(db),
      ).createExport({
        organizationId: org.id,
        actorId: user.id,
        type: 'companies',
      })

      const { filePath } = await processExport(
        db,
        { exportId: exp.id, organizationId: org.id, type: 'companies' },
        { storageDir },
      )

      const csv = await readFile(filePath!, 'utf8')
      expect(csv).toContain('"Doe, ""Jane"" Ltd"')
    })
  })
})
