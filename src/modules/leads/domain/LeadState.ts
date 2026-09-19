// Lead state machine — explicit valid transitions
export type LeadStatus =
  'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'DISQUALIFIED'

const VALID_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ['CONTACTED', 'DISQUALIFIED'],
  CONTACTED: ['QUALIFIED', 'DISQUALIFIED'],
  QUALIFIED: ['CONVERTED', 'DISQUALIFIED'],
  CONVERTED: [], // terminal
  DISQUALIFIED: [], // terminal
}

export function canTransitionLead(
  current: LeadStatus,
  next: LeadStatus,
): boolean {
  return VALID_TRANSITIONS[current]?.includes(next) ?? false
}

export function getValidLeadTransitions(current: LeadStatus): LeadStatus[] {
  return VALID_TRANSITIONS[current] ?? []
}
