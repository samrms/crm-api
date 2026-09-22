export type DealStage =
  'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST'

const VALID_TRANSITIONS: Record<DealStage, DealStage[]> = {
  NEW: ['QUALIFIED'],
  QUALIFIED: ['PROPOSAL'],
  PROPOSAL: ['NEGOTIATION'],
  NEGOTIATION: ['WON', 'LOST'],
  WON: [],
  LOST: [],
}

export function canTransitionDeal(
  current: DealStage,
  next: DealStage,
): boolean {
  return VALID_TRANSITIONS[current]?.includes(next) ?? false
}

export function getValidDealTransitions(current: DealStage): DealStage[] {
  return VALID_TRANSITIONS[current] ?? []
}
