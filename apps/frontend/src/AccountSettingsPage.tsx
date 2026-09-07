import React, { useState, useContext, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './components/ui/card'
import { Button } from './components/ui/button'
import { Alert, AlertDescription } from './components/ui/alert'
import { DeleteProfileDialog } from './components/DeleteProfileDialog'
import { ApiClientContext } from './App'
import { deleteLocalProfile, fetchLocalProfileBackup } from './authSession'
import type {
  DeleteProfileResponse,
  HouseholdProfile,
  ProfileBackupPayload,
} from '@portfolio-engineering/shared-types/auth'

export interface AccountSettingsPageProps {
  userId?: string
  userDisplayName: string
  userEmail?: string
  appMode?: 'local' | 'hosted'
  onProfileDeleted: () => void
}

function buildDefaultProfile(
  userId: string | undefined,
  userDisplayName: string,
  userEmail?: string,
): HouseholdProfile {
  return {
    id: userId ?? 'active-user',
    displayName: userDisplayName,
    email:
      userEmail ?? `${userDisplayName.toLowerCase().replace(/\s+/g, '-')}@local.invalid`,
    journalEntryCount: 0,
    hasInvestorProfile: false,
  }
}

export function buildProfileSummaryFromBackup(input: {
  userId: string | undefined
  userDisplayName: string
  userEmail?: string
  backup: ProfileBackupPayload
}): HouseholdProfile {
  const backupProfile = input.backup.data.profile
  return {
    id: input.userId ?? 'active-user',
    displayName: backupProfile.displayName || input.userDisplayName,
    email: backupProfile.email || input.userEmail || 'unknown@local.invalid',
    journalEntryCount: input.backup.data.journal.count ?? 0,
    hasInvestorProfile: Boolean(input.backup.data.investorProfile),
  }
}

export const AccountSettingsPage: React.FC<AccountSettingsPageProps> = ({
  userId,
  userDisplayName,
  userEmail,
  appMode = 'local',
  onProfileDeleted,
}) => {
  const apiClient = useContext(ApiClientContext)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentProfile, setCurrentProfile] = useState<HouseholdProfile>(() =>
    buildDefaultProfile(userId, userDisplayName, userEmail),
  )

  useEffect(() => {
    let isMounted = true

    const loadCurrentProfileSummary = async () => {
      if (!userId) {
        return
      }

      try {
        let payload: ProfileBackupPayload

        if (appMode === 'hosted') {
          if (!apiClient) {
            throw new Error('API client not available')
          }
          payload = await apiClient.exportProfileBackup()
        } else {
          payload = await fetchLocalProfileBackup(userId)
        }

        if (!isMounted) {
          return
        }

        setCurrentProfile(
          buildProfileSummaryFromBackup({
            userId,
            userDisplayName,
            userEmail,
            backup: payload,
          }),
        )
      } catch (loadError) {
        if (!isMounted) {
          return
        }

        setCurrentProfile((previous) => ({
          ...previous,
          id: userId,
          displayName: userDisplayName,
          email: userEmail || previous.email || `${userDisplayName.toLowerCase().replace(/\s+/g, '-')}@local.invalid`,
          journalEntryCount: previous.journalEntryCount ?? 0,
          hasInvestorProfile: previous.hasInvestorProfile ?? false,
        }))

        console.warn('Unable to load active profile impact summary.', loadError)
      }
    }

    void loadCurrentProfileSummary()

    return () => {
      isMounted = false
    }
  }, [apiClient, appMode, userDisplayName, userEmail, userId])

  const handleExportBackup = async (profileId: string) => {
    if (profileId && appMode === 'hosted' && apiClient) {
      return apiClient.exportProfileBackup()
    }

    if (profileId) {
      return fetchLocalProfileBackup(profileId)
    }

    throw new Error('Profile ID not available for backup export.')
  }

  const handleDeleteProfile = async (profileId: string): Promise<DeleteProfileResponse> => {
    if (profileId && appMode === 'hosted' && apiClient) {
      return apiClient.deleteProfile()
    }

    if (profileId) {
      return deleteLocalProfile(profileId)
    }

    throw new Error('Profile ID not available for deletion.')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
          <CardDescription>
            Your current active identity in this {appMode} deployment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-text-muted">Display Name</p>
              <p className="text-base font-semibold text-text-strong">{currentProfile.displayName}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Email Address</p>
              <p className="text-base font-semibold text-text-strong">
                {currentProfile.email || '(Local profile)'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-state-error/30">
        <CardHeader>
          <CardTitle className="text-state-error">Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete this profile and all associated data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              Deleting your profile will permanently remove your user identity, investor
              settings, and all associated journal entries. A portable JSON safety backup
              will automatically be downloaded to your computer before deletion is completed.
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant="destructive"
              onClick={() => {
                setError(null)
                setIsDeleteDialogOpen(true)
              }}
            >
              Delete My Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <DeleteProfileDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        profile={currentProfile}
        exportBackupFn={handleExportBackup}
        deleteProfileFn={handleDeleteProfile}
        onProfileDeleted={() => {
          onProfileDeleted()
        }}
      />
    </div>
  )
}
