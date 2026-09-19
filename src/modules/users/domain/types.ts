import type {
  UsersTable,
  MembershipsTable,
} from '../../../shared/database/types.js'

export type UserRow = UsersTable
export type MembershipRow = MembershipsTable
export type Role = 'OWNER' | 'ADMIN' | 'MEMBER'
