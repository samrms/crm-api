import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  startTestDatabase,
  stopTestDatabase,
  getTestDb,
} from '../fixtures/testDatabase.js'
import {
  createTestOrganization,
  createTestUser,
  cleanupTestData,
} from '../fixtures/factories.js'
import { ImportService } from '../../src/modules/bulk/imports/application/ImportService.js'
import { PostgresImportRepository } from '../../src/modules/bulk/imports/infrastructure/PostgresImportRepository.js'
import { ExportService } from '../../src/modules/bulk/exports/application/ExportService.js'
import { PostgresExportRepository } from '../../src/modules/bulk/exports/infrastructure/PostgresExportRepository.js'
import { OutboxRelay } from '../../src/shared/queue/outboxRelay.js'
import type {
  JobData,
  JobName,
  JobProducer,
} from '../../src/shared/queue/queue.js'

interface EnqueuedJob {
  name: JobName
  data: JobData
  jobId?: string
}

function fakeProducer(): { jobs: EnqueuedJob[]; producer: JobProducer } {
  const jobs: EnqueuedJob[] = []
  return {
    jobs,
    producer: {
      async add(name, data, opts) {
        jobs.push({ name, data, jobId: opts?.jobId })
      },
    },
  }
}

describe('Integration: Outbox relay', () => {
  beforeAll(async () => {
    await startTestDatabase()
  })

  afterAll(async () => {
    await stopTestDatabase()
  })

  beforeEach(async () => {
    await cleanupTestData()
  })

  it('enqueues an import job and acknowledges the outbox row', async () => {
    const db = getTestDb()
    const org = await createTestOrganization()
    const user = await createTestUser()
    const { jobs, producer } = fakeProducer()

    const imp = await new ImportService(
      db,
      new PostgresImportRepository(db),
    ).createImport({
      organizationId: org.id,
      actorId: user.id,
      type: 'companies',
      filePath: '/tmp/incoming.csv',
    })

    const relay = new OutboxRelay(() => db, producer)
    const dispatched = await relay.dispatchOnce()

    expect(dispatched).toBe(1)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]!.name).toBe('process-import')
    expect(jobs[0]!.data).toMatchObject({
      organizationId: org.id,
      importId: imp.id,
      type: 'companies',
      filePath: '/tmp/incoming.csv',
    })

    const [event] = await db
      .selectFrom('outbox_events')
      .selectAll()
      .where('type', '=', 'IMPORT_CREATED')
      .execute()
    // Deterministic id keeps BullMQ from enqueueing the same row twice.
    expect(jobs[0]!.jobId).toBe(`outbox_${event!.id}`)
    expect(event!.processed_at).not.toBeNull()
  })

  it('is idempotent: a second pass finds nothing to dispatch', async () => {
    const db = getTestDb()
    const org = await createTestOrganization()
    const user = await createTestUser()
    const { jobs, producer } = fakeProducer()

    await new ExportService(db, new PostgresExportRepository(db)).createExport({
      organizationId: org.id,
      actorId: user.id,
      type: 'deals',
    })

    const relay = new OutboxRelay(() => db, producer)
    expect(await relay.dispatchOnce()).toBe(1)
    expect(await relay.dispatchOnce()).toBe(0)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]!.name).toBe('process-export')
    expect(jobs[0]!.data).toMatchObject({ type: 'deals' })
  })

  it('acknowledges events that have no queue route without enqueuing', async () => {
    const db = getTestDb()
    const org = await createTestOrganization()
    const { jobs, producer } = fakeProducer()

    await db
      .insertInto('outbox_events')
      .values({
        id: 'ob_no_route',
        organization_id: org.id,
        type: 'LEAD_CONVERTED',
        payload: { leadId: 'ld_1' },
        created_at: new Date(),
      })
      .execute()

    const relay = new OutboxRelay(() => db, producer)
    expect(await relay.dispatchOnce()).toBe(0)
    expect(jobs).toHaveLength(0)

    const [event] = await db
      .selectFrom('outbox_events')
      .selectAll()
      .where('id', '=', 'ob_no_route')
      .execute()
    expect(event!.processed_at).not.toBeNull()
  })

  it('leaves the event unprocessed when the enqueue fails', async () => {
    const db = getTestDb()
    const org = await createTestOrganization()
    const user = await createTestUser()

    await new ImportService(db, new PostgresImportRepository(db)).createImport({
      organizationId: org.id,
      actorId: user.id,
      type: 'leads',
      filePath: '/tmp/failing.csv',
    })

    const failing: JobProducer = {
      async add() {
        throw new Error('redis unavailable')
      },
    }

    const relay = new OutboxRelay(() => db, failing)
    await expect(relay.dispatchOnce()).rejects.toThrow('redis unavailable')

    const [event] = await db
      .selectFrom('outbox_events')
      .selectAll()
      .where('type', '=', 'IMPORT_CREATED')
      .execute()
    // At-least-once: the row survives so the next tick can retry it.
    expect(event!.processed_at).toBeNull()
  })

  it('starts polling and stops cleanly', async () => {
    const db = getTestDb()
    const { producer } = fakeProducer()

    const relay = new OutboxRelay(() => db, producer, { intervalMs: 5 })
    relay.start()
    relay.start() // double start is a no-op
    await relay.stop()
    await relay.stop() // double stop is a no-op
  })
})
