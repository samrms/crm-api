import { describe, it, expect } from 'vitest'
import {
  canTransitionLead,
  getValidLeadTransitions,
} from '../../../src/modules/leads/domain/LeadState.ts'

describe('Lead State Machine', () => {
  describe('valid transitions', () => {
    it('NEW -> CONTACTED', () => {
      expect(canTransitionLead('NEW', 'CONTACTED')).toBe(true)
    })

    it('NEW -> DISQUALIFIED', () => {
      expect(canTransitionLead('NEW', 'DISQUALIFIED')).toBe(true)
    })

    it('CONTACTED -> QUALIFIED', () => {
      expect(canTransitionLead('CONTACTED', 'QUALIFIED')).toBe(true)
    })

    it('CONTACTED -> DISQUALIFIED', () => {
      expect(canTransitionLead('CONTACTED', 'DISQUALIFIED')).toBe(true)
    })

    it('QUALIFIED -> CONVERTED', () => {
      expect(canTransitionLead('QUALIFIED', 'CONVERTED')).toBe(true)
    })

    it('QUALIFIED -> DISQUALIFIED', () => {
      expect(canTransitionLead('QUALIFIED', 'DISQUALIFIED')).toBe(true)
    })
  })

  describe('invalid transitions', () => {
    it('NEW -> QUALIFIED (skip CONTACTED)', () => {
      expect(canTransitionLead('NEW', 'QUALIFIED')).toBe(false)
    })

    it('NEW -> CONVERTED', () => {
      expect(canTransitionLead('NEW', 'CONVERTED')).toBe(false)
    })

    it('CONTACTED -> CONVERTED', () => {
      expect(canTransitionLead('CONTACTED', 'CONVERTED')).toBe(false)
    })

    it('CONVERTED -> any (terminal)', () => {
      expect(canTransitionLead('CONVERTED', 'NEW')).toBe(false)
      expect(canTransitionLead('CONVERTED', 'CONTACTED')).toBe(false)
      expect(canTransitionLead('CONVERTED', 'QUALIFIED')).toBe(false)
      expect(canTransitionLead('CONVERTED', 'DISQUALIFIED')).toBe(false)
    })

    it('DISQUALIFIED -> any (terminal)', () => {
      expect(canTransitionLead('DISQUALIFIED', 'NEW')).toBe(false)
      expect(canTransitionLead('DISQUALIFIED', 'CONTACTED')).toBe(false)
      expect(canTransitionLead('DISQUALIFIED', 'QUALIFIED')).toBe(false)
      expect(canTransitionLead('DISQUALIFIED', 'CONVERTED')).toBe(false)
    })
  })

  describe('getValidLeadTransitions', () => {
    it('NEW allows CONTACTED and DISQUALIFIED', () => {
      expect(getValidLeadTransitions('NEW')).toEqual([
        'CONTACTED',
        'DISQUALIFIED',
      ])
    })

    it('QUALIFIED allows CONVERTED and DISQUALIFIED', () => {
      expect(getValidLeadTransitions('QUALIFIED')).toEqual([
        'CONVERTED',
        'DISQUALIFIED',
      ])
    })

    it('CONVERTED allows nothing', () => {
      expect(getValidLeadTransitions('CONVERTED')).toEqual([])
    })
  })
})
