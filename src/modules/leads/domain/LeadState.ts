export type LeadStatus =
  'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'DISQUALIFIED'

const VALID_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ['CONTACTED', 'DISQUALIFIED'],
  CONTACTED: ['QUALIFIED', 'DISQUALIFIED'],
  QUALIFIED: ['CONVERTED', 'DISQUALIFIED'],
  CONVERTED: [],
  DISQUALIFIED: [],
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

/**
 * BFS through the state machine to find the shortest path of
 * intermediate transitions from `from` to `to`.
 * Returns the list of states to visit (excluding `from`), or null
 * if no path exists.
 */
export function findTransitionPath(
  from: LeadStatus,
  to: LeadStatus,
): LeadStatus[] | null {
  if (from === to) return []

  const queue: Array<{ state: LeadStatus; path: LeadStatus[] }> = [
    { state: from, path: [] },
  ]
  const visited = new Set<LeadStatus>()

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current.state === to) return current.path
    if (visited.has(current.state)) continue
    visited.add(current.state)

    for (const next of getValidLeadTransitions(current.state)) {
      if (!visited.has(next)) {
        queue.push({ state: next, path: [...current.path, next] })
      }
    }
  }

  return null
}
