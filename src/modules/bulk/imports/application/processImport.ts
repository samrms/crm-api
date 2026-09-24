import type { Kysely } from 'kysely'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import type { Database } from '@/shared/database/types.js'
import { newId } from '@/shared/utils/id.js'
import { parseCsvTable } from '@/shared/utils/csv.js'
import { logger } from '@/shared/logging/logger.js'
import {
  PostgresImportRepository,
  type ImportRepository,
} from '../infrastructure/PostgresImportRepository.js'

export interface ProcessImportInput {
  importId: string
  organizationId: string
  type: string
  filePath: string
}

export interface ProcessImportResult {
  
  skipped: boolean
  total: number
  successful: number
  failed: number
}

type ImportType = 'companies' | 'contacts' | 'leads'

const PROGRESS_FLUSH_EVERY = 50

const MAX_REPORTED_ERRORS = 5

const companyRowSchema = z.object({
  name: z.string().min(1).max(255),
  domain: z.string().max(255).optional(),
  industry: z.string().max(255).optional(),
  size: z.string().max(50).optional(),
  website: z.string().url().max(255).optional(),
  notes: z.string().max(5000).optional(),
})

const contactRowSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  phone: z.string().max(50).optional(),
  title: z.string().max(255).optional(),
  notes: z.string().max(5000).optional(),
  companyId: z.string().optional(),
})

const leadRowSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  company: z.string().max(255).optional(),
  source: z.string().max(255).optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED']).optional(),
  notes: z.string().max(5000).optional(),
})

type RowSchema =
  typeof companyRowSchema | typeof contactRowSchema | typeof leadRowSchema

interface ImportShape {
  columns: string[]
  required: string[]
  schema: RowSchema
}

const SHAPES: Record<ImportType, ImportShape> = {
  companies: {
    columns: ['name', 'domain', 'industry', 'size', 'website', 'notes'],
    required: ['name'],
    schema: companyRowSchema,
  },
  contacts: {
    columns: [
      'email',
      'firstName',
      'lastName',
      'phone',
      'title',
      'notes',
      'companyId',
    ],
    required: ['email', 'firstName', 'lastName'],
    schema: contactRowSchema,
  },
  leads: {
    columns: [
      'email',
      'firstName',
      'lastName',
      'company',
      'source',
      'status',
      'notes',
    ],
    required: ['email', 'firstName', 'lastName'],
    schema: leadRowSchema,
  },
}

function isImportType(value: string): value is ImportType {
  return value === 'companies' || value === 'contacts' || value === 'leads'
}

function normalizeHeader(
  header: string[],
  known: string[],
): { columns: string[]; unknown: string[] } {
  const lookup = new Map(known.map((column) => [column.toLowerCase(), column]))
  const columns: string[] = []
  const unknown: string[] = []

  for (const raw of header) {
    const canonical = lookup.get(raw.toLowerCase())
    if (canonical) {
      columns.push(canonical)
    } else if (raw !== '') {
      unknown.push(raw)
    }
  }
  return { columns, unknown }
}

function blankToUndefined(
  record: Record<string, string>,
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      value === '' ? undefined : value,
    ]),
  )
}

function str(value: string | undefined): string | null {
  return value === undefined || value === '' ? null : value
}

export async function processImport(
  db: Kysely<Database>,
  input: ProcessImportInput,
  deps: { repo?: ImportRepository } = {},
): Promise<ProcessImportResult> {
  const repo = deps.repo ?? new PostgresImportRepository(db)
  const { importId, organizationId, type, filePath } = input

  const existing = await repo.findById(importId, organizationId)
  if (!existing) {
    throw new Error(`Import ${importId} not found`)
  }
  if (existing.status === 'COMPLETED') {
    logger.info({ importId }, 'Import already completed, skipping')
    return {
      skipped: true,
      total: existing.total,
      successful: existing.successful,
      failed: existing.failed,
    }
  }

  if (!isImportType(type)) {
    await repo.updateStatus(
      importId,
      'FAILED',
      `Unsupported import type: ${type}`,
    )
    return { skipped: false, total: 0, successful: 0, failed: 0 }
  }

  await repo.updateStatus(importId, 'PROCESSING')
  const shape = SHAPES[type]

  let csv: string
  try {
    csv = await readFile(filePath, 'utf8')
  } catch {
    const message = `CSV file not found at ${filePath}`
    logger.warn({ importId, filePath }, message)
    await repo.updateStatus(importId, 'FAILED', message)
    return { skipped: false, total: 0, successful: 0, failed: 0 }
  }

  const { header, records } = parseCsvTable(csv)
  const { columns, unknown } = normalizeHeader(header, shape.columns)

  if (unknown.length > 0) {
    const message = `Unknown column(s): ${unknown.join(', ')}. Allowed: ${shape.columns.join(', ')}`
    await repo.updateStatus(importId, 'FAILED', message)
    return { skipped: false, total: 0, successful: 0, failed: 0 }
  }

  const missing = shape.required.filter((column) => !columns.includes(column))
  if (missing.length > 0) {
    const message = `Missing required column(s): ${missing.join(', ')}`
    await repo.updateStatus(importId, 'FAILED', message)
    return { skipped: false, total: 0, successful: 0, failed: 0 }
  }

  await repo.updateProgress(importId, {
    total: records.length,
    processed: 0,
    successful: 0,
    failed: 0,
  })

  let successful = 0
  let failed = 0
  const errors: string[] = []

  for (const [index, raw] of records.entries()) {
    try {
      const row = shape.schema.parse(blankToUndefined(raw))
      await insertRow(db, type, row, organizationId)
      successful += 1
    } catch (error) {
      failed += 1
      if (errors.length < MAX_REPORTED_ERRORS) {
        const message =
          error instanceof Error ? error.message : 'Unknown row error'
        errors.push(`Row ${index + 2}: ${message}`)
      }
    }

    if ((index + 1) % PROGRESS_FLUSH_EVERY === 0) {
      await repo.updateProgress(importId, {
        total: records.length,
        processed: index + 1,
        successful,
        failed,
      })
    }
  }

  await repo.updateProgress(importId, {
    total: records.length,
    processed: records.length,
    successful,
    failed,
  })

  if (failed > 0 && successful === 0) {
    await repo.updateStatus(
      importId,
      'FAILED',
      `All ${failed} row(s) failed. ${errors.join('; ')}`,
    )
  } else {
    await repo.updateStatus(
      importId,
      'COMPLETED',
      errors.length > 0
        ? `${failed} of ${records.length} row(s) skipped: ${errors.join('; ')}`
        : undefined,
    )
    logger.info({ importId, successful, failed }, 'Import completed')
  }

  return { skipped: false, total: records.length, successful, failed }
}

async function insertRow(
  db: Kysely<Database>,
  type: ImportType,
  row: Record<string, string | undefined>,
  organizationId: string,
): Promise<void> {
  const now = new Date()

  if (type === 'companies') {
    await db
      .insertInto('companies')
      .values({
        id: newId('co'),
        organization_id: organizationId,
        name: str(row.name) ?? '',
        domain: str(row.domain),
        industry: str(row.industry),
        size: str(row.size),
        website: str(row.website),
        notes: str(row.notes),
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .execute()
    return
  }

  if (type === 'contacts') {
    const companyId = str(row.companyId)
    if (companyId) {
      const parent = await db
        .selectFrom('companies')
        .select('id')
        .where('id', '=', companyId)
        .where('organization_id', '=', organizationId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst()
      if (!parent) {
        throw new Error(
          `companyId ${companyId} does not exist in this organization`,
        )
      }
    }

    await db
      .insertInto('contacts')
      .values({
        id: newId('ct'),
        organization_id: organizationId,
        company_id: companyId,
        email: str(row.email) ?? '',
        firstName: str(row.firstName) ?? '',
        lastName: str(row.lastName) ?? '',
        phone: str(row.phone),
        title: str(row.title),
        notes: str(row.notes),
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .execute()
    return
  }

  await db
    .insertInto('leads')
    .values({
      id: newId('ld'),
      organization_id: organizationId,
      companyId: null,
      contactId: null,
      email: str(row.email) ?? '',
      firstName: str(row.firstName) ?? '',
      lastName: str(row.lastName) ?? '',
      company: str(row.company),
      source: str(row.source),
      status: (row.status as 'NEW' | 'CONTACTED' | 'QUALIFIED') ?? 'NEW',
      convertedDealId: null,
      notes: str(row.notes),
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
    })
    .execute()
}
