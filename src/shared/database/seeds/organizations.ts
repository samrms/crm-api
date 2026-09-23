import type { Kysely } from 'kysely'
import type { Database } from '@/shared/database/types.js'
import { newId } from '@/shared/utils/id.js'
import { toSlug } from '@/shared/utils/slug.js'

export async function seedOrganizations(
  db: Kysely<Database>,
): Promise<{ orgId: string }> {
  const orgId = newId('org')
  const orgName = 'Acme'
  const now = new Date()
  await db
    .insertInto('organizations')
    .values({
      id: orgId,
      name: orgName,
      slug: toSlug(orgName),
      created_at: now,
      updated_at: now,
    })
    .execute()
  return { orgId }
}
