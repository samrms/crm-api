import type { Kysely } from 'kysely'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Database } from '@/shared/database/types.js'
import { toCsv } from '@/shared/utils/csv.js'
import { config } from '@/shared/config.js'
import { logger } from '@/shared/logging/logger.js'
import {
  PostgresExportRepository,
  type ExportRepository,
} from '../infrastructure/PostgresExportRepository.js'

export interface ProcessExportInput {
  exportId: string
  organizationId: string
  type: string
}

export interface ProcessExportResult {
  skipped: boolean
  rows: number
  filePath?: string
  downloadUrl?: string
}

type ExportType = 'companies' | 'contacts' | 'leads' | 'deals'

interface ExportShape {
  header: string[]

  select: (row: Record<string, unknown>) => unknown[]
}

const iso = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  return value instanceof Date ? value.toISOString() : String(value)
}

const nullable = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value)

const SHAPES: Record<ExportType, ExportShape> = {
  companies: {
    header: [
      'id',
      'name',
      'domain',
      'industry',
      'size',
      'website',
      'notes',
      'createdAt',
    ],
    select: (row) => [
      row.id,
      row.name,
      nullable(row.domain),
      nullable(row.industry),
      nullable(row.size),
      nullable(row.website),
      nullable(row.notes),
      iso(row.created_at),
    ],
  },
  contacts: {
    header: [
      'id',
      'email',
      'firstName',
      'lastName',
      'phone',
      'title',
      'companyId',
      'notes',
      'createdAt',
    ],
    select: (row) => [
      row.id,
      row.email,
      row.firstName,
      row.lastName,
      nullable(row.phone),
      nullable(row.title),
      nullable(row.company_id),
      nullable(row.notes),
      iso(row.created_at),
    ],
  },
  leads: {
    header: [
      'id',
      'email',
      'firstName',
      'lastName',
      'company',
      'source',
      'status',
      'notes',
      'createdAt',
    ],
    select: (row) => [
      row.id,
      row.email,
      row.firstName,
      row.lastName,
      nullable(row.company),
      nullable(row.source),
      row.status,
      nullable(row.notes),
      iso(row.created_at),
    ],
  },
  deals: {
    header: [
      'id',
      'title',
      'value',
      'currency',
      'stage',
      'companyId',
      'contactId',
      'leadId',
      'expectedCloseDate',
      'notes',
      'createdAt',
    ],
    select: (row) => [
      row.id,
      row.title,
      nullable(row.value),
      row.currency,
      row.stage,
      nullable(row.companyId),
      nullable(row.contactId),
      nullable(row.leadId),
      iso(row.expectedCloseDate),
      nullable(row.notes),
      iso(row.created_at),
    ],
  },
}

function isExportType(value: string): value is ExportType {
  return value in SHAPES
}

export async function processExport(
  db: Kysely<Database>,
  input: ProcessExportInput,
  deps: { repo?: ExportRepository; storageDir?: string } = {},
): Promise<ProcessExportResult> {
  const repo = deps.repo ?? new PostgresExportRepository(db)
  const storageDir = deps.storageDir ?? config.storageDir
  const { exportId, organizationId, type } = input

  const existing = await repo.findById(exportId, organizationId)
  if (!existing) {
    throw new Error(`Export ${exportId} not found`)
  }
  if (existing.status === 'COMPLETED') {
    logger.info({ exportId }, 'Export already completed, skipping')
    return {
      skipped: true,
      rows: 0,
      filePath: existing.file_path ?? undefined,
      downloadUrl: existing.download_url ?? undefined,
    }
  }

  if (!isExportType(type)) {
    await repo.updateStatus(exportId, 'FAILED', {
      errorMessage: `Unsupported export type: ${type}`,
    })
    return { skipped: false, rows: 0 }
  }

  await repo.updateStatus(exportId, 'PROCESSING')

  try {
    const shape = SHAPES[type]
    const rows = await db
      .selectFrom(type)
      .selectAll()
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
      .execute()

    const csv = toCsv(
      shape.header,
      rows.map((row) => shape.select(row as Record<string, unknown>)),
    )

    const exportsDir = join(storageDir, 'exports')
    await mkdir(exportsDir, { recursive: true })
    const filePath = join(exportsDir, `${exportId}.csv`)
    await writeFile(filePath, csv, 'utf8')

    const downloadUrl = `/api/v1/exports/${exportId}/download`
    await repo.updateStatus(exportId, 'COMPLETED', { filePath, downloadUrl })

    logger.info({ exportId, rows: rows.length }, 'Export completed')
    return { skipped: false, rows: rows.length, filePath, downloadUrl }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await repo.updateStatus(exportId, 'FAILED', { errorMessage: message })
    throw error
  }
}
