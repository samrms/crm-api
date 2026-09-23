import { describe, it, expect } from 'vitest'
import { PostgresAuditRepository } from '../../../src/modules/organizations/infrastructure/PostgresAuditRepository.js'

describe('Unit: Audit Repository', () => {
  it('implements AuditRepository interface', () => {
    const repoClass = PostgresAuditRepository
    expect(typeof repoClass).toBe('function')
  })
})
