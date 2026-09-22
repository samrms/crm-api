import { nanoid } from 'nanoid'
import type { MembershipRepository } from '@users/infrastructure/PostgresMembershipRepository.js'
import type { UserRepository } from '@users/infrastructure/PostgresUserRepository.js'
import { NotFoundError, ConflictError } from '@/shared/errors/AppError.js'
import type { Role } from '@/shared/database/types.js'

export interface InviteMemberInput {
  organizationId: string
  email: string
  role: Role
}

export class MemberService {
  constructor(
    private readonly membershipRepo: MembershipRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async listMembers(organizationId: string) {
    return this.membershipRepo.findByOrganizationId(organizationId)
  }

  async getMember(userId: string, organizationId: string) {
    const membership = await this.membershipRepo.findByUserAndOrg(
      userId,
      organizationId,
    )
    if (!membership) throw new NotFoundError('Member', userId)
    return membership
  }

  async inviteMember(input: InviteMemberInput) {
    const user = await this.userRepo.findByEmail(input.email)
    if (!user) {
      throw new NotFoundError('User with this email')
    }

    const existing = await this.membershipRepo.findByUserAndOrg(
      user.id,
      input.organizationId,
    )
    if (existing) {
      throw new ConflictError('User is already a member of this organization')
    }

    const id = `mem_${nanoid(12)}`
    return this.membershipRepo.create({
      id,
      userId: user.id,
      organizationId: input.organizationId,
      role: input.role,
    })
  }

  async updateMemberRole(userId: string, organizationId: string, role: Role) {
    const membership = await this.membershipRepo.findByUserAndOrg(
      userId,
      organizationId,
    )
    if (!membership) throw new NotFoundError('Member', userId)

    const updated = await this.membershipRepo.updateRole(
      userId,
      organizationId,
      role,
    )
    if (!updated) throw new NotFoundError('Member', userId)
    return updated
  }

  async removeMember(userId: string, organizationId: string) {
    const membership = await this.membershipRepo.findByUserAndOrg(
      userId,
      organizationId,
    )
    if (!membership) throw new NotFoundError('Member', userId)

    if (membership.role === 'OWNER') {
      throw new ConflictError('Cannot remove the organization owner')
    }

    await this.membershipRepo.delete(userId, organizationId)
  }
}
