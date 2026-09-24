import { describe, it, expect } from 'vitest'
import {
  canTransitionLead,
  findTransitionPath,
  getValidLeadTransitions,
  type LeadStatus,
} from '../../../src/modules/crm/leads/domain/LeadState.ts'

describe('LeadState', () => {
  it('allows contact/disqualify from new and contacted', () => {
    expect(canTransitionLead('NEW', 'CONTACTED')).toBe(true)
    expect(canTransitionLead('NEW', 'DISQUALIFIED')).toBe(true)
    expect(canTransitionLead('CONTACTED', 'QUALIFIED')).toBe(true)
    expect(canTransitionLead('NEW', 'QUALIFIED')).toBe(false)
  })

  it('only converts from qualified', () => {
    expect(canTransitionLead('QUALIFIED', 'CONVERTED')).toBe(true)
    expect(canTransitionLead('CONTACTED', 'CONVERTED')).toBe(false)
  })

  it('finds the path new -> contacted -> qualified', () => {
    expect(findTransitionPath('NEW', 'QUALIFIED')).toEqual([
      'CONTACTED',
      'QUALIFIED',
    ])
    expect(findTransitionPath('CONTACTED', 'QUALIFIED')).toEqual(['QUALIFIED'])
  })

  it('returns an empty path for the same status and null when unreachable', () => {
    expect(findTransitionPath('QUALIFIED', 'QUALIFIED')).toEqual([])
    expect(findTransitionPath('CONVERTED', 'QUALIFIED')).toBeNull()
    expect(findTransitionPath('DISQUALIFIED', 'CONVERTED')).toBeNull()
  })

  it('rejects unknown statuses', () => {
    expect(getValidLeadTransitions('NOPE' as LeadStatus)).toEqual([])
  })
})
