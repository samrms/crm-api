import { describe, it, expect } from 'vitest'
import {
  canTransitionDeal,
  getValidDealTransitions,
  type DealStage,
} from '../../../src/modules/crm/deals/domain/DealState.ts'

describe('DealState', () => {
  it('allows only the next stage in the pipeline', () => {
    expect(canTransitionDeal('NEW', 'QUALIFIED')).toBe(true)
    expect(canTransitionDeal('QUALIFIED', 'PROPOSAL')).toBe(true)
    expect(canTransitionDeal('PROPOSAL', 'NEGOTIATION')).toBe(true)
    expect(canTransitionDeal('NEW', 'NEGOTIATION')).toBe(false)
    expect(canTransitionDeal('PROPOSAL', 'QUALIFIED')).toBe(false)
  })

  it('only allows win/lose from negotiation', () => {
    expect(canTransitionDeal('NEGOTIATION', 'WON')).toBe(true)
    expect(canTransitionDeal('NEGOTIATION', 'LOST')).toBe(true)
    expect(canTransitionDeal('NEW', 'WON')).toBe(false)
    expect(canTransitionDeal('QUALIFIED', 'LOST')).toBe(false)
  })

  it('treats terminal stages as terminal', () => {
    expect(getValidDealTransitions('WON')).toEqual([])
    expect(getValidDealTransitions('LOST')).toEqual([])
    expect(canTransitionDeal('WON', 'LOST')).toBe(false)
  })

  it('rejects unknown stages', () => {
    expect(getValidDealTransitions('BOGUS' as DealStage)).toEqual([])
    expect(canTransitionDeal('BOGUS' as DealStage, 'WON')).toBe(false)
  })
})
