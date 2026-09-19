export type Role = 'OWNER' | 'ADMIN' | 'MEMBER'

export interface Organization {
  id: string
  name: string
  slug: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface Membership {
  id: string
  userId: string
  organizationId: string
  role: Role
  createdAt: Date
  updatedAt: Date
}

export interface User {
  id: string
  email: string
  name: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}
