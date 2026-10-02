export interface ChangelogAcknowledgmentPrisma {
  changelogAcknowledgment: {
    findMany(input: {
      where: {
        organizationId: string
        userId: string
      }
      select: {
        sectionIdentity: true
      }
      orderBy: {
        sectionIdentity: 'asc'
      }
    }): Promise<Array<{ sectionIdentity: string }>>
    createMany(input: {
      data: Array<{
        organizationId: string
        userId: string
        sectionIdentity: string
      }>
      skipDuplicates: true
    }): Promise<{ count: number }>
  }
}

export interface ChangelogAcknowledgmentStore {
  listAcknowledgedSectionIdentities(input: {
    organizationId: string
    userId: string
  }): Promise<string[]>
  acknowledgeSections(input: {
    organizationId: string
    userId: string
    sectionIdentities: string[]
  }): Promise<number>
}

export function createChangelogAcknowledgmentStore(
  prisma: ChangelogAcknowledgmentPrisma,
): ChangelogAcknowledgmentStore {
  return {
    async listAcknowledgedSectionIdentities({ organizationId, userId }) {
      const records = await prisma.changelogAcknowledgment.findMany({
        where: { organizationId, userId },
        select: { sectionIdentity: true },
        orderBy: { sectionIdentity: 'asc' },
      })
      return records.map((record) => record.sectionIdentity)
    },

    async acknowledgeSections({ organizationId, userId, sectionIdentities }) {
      if (sectionIdentities.some((identity) => identity.length === 0)) {
        throw new Error('Changelog section identities must not be empty.')
      }

      const uniqueSectionIdentities = [...new Set(sectionIdentities)]
      if (uniqueSectionIdentities.length === 0) {
        return 0
      }

      const result = await prisma.changelogAcknowledgment.createMany({
        data: uniqueSectionIdentities.map((sectionIdentity) => ({
          organizationId,
          userId,
          sectionIdentity,
        })),
        skipDuplicates: true,
      })
      return result.count
    },
  }
}
