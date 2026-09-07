import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildProfileSummaryFromBackup } from './AccountSettingsPage.ts'

const backupPayload = {
  $schema: 'https://portfolio-engineering.org/schemas/v1/profile-backup.json',
  version: '1.0.0',
  exportedAt: '2026-09-06T19:30:00.000Z',
  appVersion: '0.1.0',
  appMode: 'local',
  _meta: {
    description: 'Portfolio Engineering (P/OS) Profile and User Data Backup',
    sections: {
      profile: 'Core user identity and display attributes',
      investorProfile: 'Investor persona, strategy preferences, and AI context parameters',
      journal: 'Complete chronological journal entries and daily reflections',
    },
  },
  data: {
    profile: {
      displayName: 'Alex Investor',
      email: 'alex@local.invalid',
      role: 'member',
      createdAt: '2026-01-15T12:00:00.000Z',
    },
    investorProfile: {
      preferredName: 'Alex Investor',
      experienceLevel: 'intermediate',
      portfolioContext: { focus: 'long-term growth' },
      primaryObjective: 'growth',
      strategyPresets: ['dividend_growth'],
      customStrategyDescription: 'Core strategy',
      freeformAiContext: 'Focus on long-term growth',
    },
    journal: {
      count: 42,
      entries: [
        {
          localDate: '2026-09-01',
          content: 'Reviewed portfolio',
          createdAt: '2026-09-01T14:22:00.000Z',
          updatedAt: '2026-09-01T14:25:00.000Z',
        },
      ],
    },
  },
} as const

test('buildProfileSummaryFromBackup uses the actual authenticated profile and server summary data', () => {
  const summary = buildProfileSummaryFromBackup({
    userId: 'user-123',
    userDisplayName: 'Fallback Name',
    userEmail: 'fallback@example.com',
    backup: backupPayload,
  })

  assert.equal(summary.id, 'user-123')
  assert.equal(summary.displayName, 'Alex Investor')
  assert.equal(summary.email, 'alex@local.invalid')
  assert.equal(summary.journalEntryCount, 42)
  assert.equal(summary.hasInvestorProfile, true)
})

test('buildProfileSummaryFromBackup falls back to the session values when the backup is partial', () => {
  const summary = buildProfileSummaryFromBackup({
    userId: 'user-456',
    userDisplayName: 'Fallback Name',
    userEmail: 'fallback@example.com',
    backup: {
      ...backupPayload,
      data: {
        ...backupPayload.data,
        profile: {
          ...backupPayload.data.profile,
          displayName: '',
          email: '',
        },
        investorProfile: null,
        journal: {
          ...backupPayload.data.journal,
          count: 0,
        },
      },
    },
  })

  assert.equal(summary.id, 'user-456')
  assert.equal(summary.displayName, 'Fallback Name')
  assert.equal(summary.email, 'fallback@example.com')
  assert.equal(summary.journalEntryCount, 0)
  assert.equal(summary.hasInvestorProfile, false)
})
