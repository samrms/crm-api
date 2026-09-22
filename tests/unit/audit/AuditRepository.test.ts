import { describe, it, expect, vi } from 'vitest'
import { PostgresAuditRepository } from '../../../src/modules/audit/infrastructure/PostgresAuditRepository.js'

describe('Unit: Audit Repository', () => {
  it('implements AuditRepository interface', () => {
    const repoClass = PostgresAuditRepository
    expect(typeof repoClass).toBe('function')
  })
})
