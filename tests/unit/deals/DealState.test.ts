import { describe, it, expect } from 'vitest'
import {
  canTransitionDeal,
  getValidDealTransitions,
} from '../../../src/modules/deals/domain/DealState.ts'

describe('Deal State Machine', () => {
  describe('valid transitions', () => {
    it('NEW -> QUALIFIED', () => {
      expect(canTransitionDeal('NEW', 'QUALIFIED')).toBe(true)
    })

    it('QUALIFIED -> PROPOSAL', () => {
      expect(canTransitionDeal('QUALIFIED', 'PROPOSAL')).toBe(true)
    })

    it('PROPOSAL -> NEGOTIATION', () => {
      expect(canTransitionDeal('PROPOSAL', 'NEGOTIATION')).toBe(true)
    })

    it('NEGOTIATION -> WON', () => {
      expect(canTransitionDeal('NEGOTIATION', 'WON')).toBe(true)
    })

    it('NEGOTIATION -> LOST', () => {
      expect(canTransitionDeal('NEGOTIATION', 'LOST')).toBe(true)
    })
  })

  describe('invalid transitions', () => {
    it('NEW -> PROPOSAL (skip QUALIFIED)', () => {
      expect(canTransitionDeal('NEW', 'PROPOSAL')).toBe(false)
    })

    it('NEW -> WON', () => {
      expect(canTransitionDeal('NEW', 'WON')).toBe(false)
    })

    it('QUALIFIED -> NEGOTIATION', () => {
      expect(canTransitionDeal('QUALIFIED', 'NEGOTIATION')).toBe(false)
    })

    it('WON -> any (terminal)', () => {
      expect(canTransitionDeal('WON', 'NEW')).toBe(false)
      expect(canTransitionDeal('WON', 'QUALIFIED')).toBe(false)
      expect(canTransitionDeal('WON', 'LOST')).toBe(false)
    })

    it('LOST -> any (terminal)', () => {
      expect(canTransitionDeal('LOST', 'NEW')).toBe(false)
      expect(canTransitionDeal('LOST', 'WON')).toBe(false)
    })
  })

  describe('getValidDealTransitions', () => {
    it('NEW allows QUALIFIED', () => {
      expect(getValidDealTransitions('NEW')).toEqual(['QUALIFIED'])
    })

    it('NEGOTIATION allows WON and LOST', () => {
      expect(getValidDealTransitions('NEGOTIATION')).toEqual(['WON', 'LOST'])
    })

    it('WON allows nothing', () => {
      expect(getValidDealTransitions('WON')).toEqual([])
    })
  })
})
