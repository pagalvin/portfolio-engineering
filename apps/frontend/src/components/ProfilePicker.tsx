import React, { useState, useEffect } from 'react'
import type { HouseholdProfile, ProfilesResponse } from '@portfolio-engineering/shared-types/auth'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog'
import { Alert, AlertDescription } from './ui/alert'
import { DeleteProfileDialog } from './DeleteProfileDialog'

export interface ProfilePickerProps {
  onSelectProfile: (profileId: string) => Promise<void>
  onCreateProfile?: (displayName: string, email?: string) => Promise<HouseholdProfile>
  initialProfiles?: readonly HouseholdProfile[]
}

export const ProfilePicker: React.FC<ProfilePickerProps> = ({
  onSelectProfile,
  onCreateProfile,
  initialProfiles,
}) => {
  const [profiles, setProfiles] = useState<readonly HouseholdProfile[]>(
    initialProfiles || [],
  )
  const [isLoading, setIsLoading] = useState(!initialProfiles)
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Dialog & Form state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Delete dialog state
  const [profileToDelete, setProfileToDelete] = useState<HouseholdProfile | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (initialProfiles) {
      setProfiles(initialProfiles)
      setIsLoading(false)
      return
    }

    async function loadProfiles() {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch('/auth/profiles', {
          credentials: 'include',
        })
        if (!response.ok) {
          throw new Error(`Failed to load profiles (${response.status})`)
        }
        const data = (await response.json()) as ProfilesResponse
        setProfiles(data.profiles)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch household profiles',
        )
      } finally {
        setIsLoading(false)
      }
    }

    loadProfiles()
  }, [initialProfiles])

  const handleSelect = async (profileId: string) => {
    setSelectingId(profileId)
    setError(null)
    try {
      await onSelectProfile(profileId)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to select profile',
      )
      setSelectingId(null)
    }
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDisplayName.trim()) {
      setCreateError('Display name is required.')
      return
    }

    setIsCreating(true)
    setCreateError(null)

    try {
      let createdProfile: HouseholdProfile

      if (onCreateProfile) {
        createdProfile = await onCreateProfile(
          newDisplayName.trim(),
          newEmail.trim() || undefined,
        )
      } else {
        const existingProfileIds = new Set(profiles.map((profile) => profile.id))
        const response = await fetch('/auth/profiles', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: newDisplayName.trim(),
            email: newEmail.trim() || undefined,
          }),
        })

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.message || 'Failed to create profile')
        }

        const data = (await response.json()) as ProfilesResponse
        const createdOrUpdatedProfile = data.profiles.find(
          (profile) => !existingProfileIds.has(profile.id),
        )
        createdProfile = createdOrUpdatedProfile ?? data.profiles[0]
        setProfiles(data.profiles)
      }

      if (!createdProfile) {
        throw new Error('Profile was created, but the API did not return it.')
      }

      if (onCreateProfile) {
        setProfiles((prev) => [...prev, createdProfile])
      }
      setIsModalOpen(false)
      setNewDisplayName('')
      setNewEmail('')

      // Automatically select newly created profile
      await handleSelect(createdProfile.id)
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Failed to create profile',
      )
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted p-4 sm:p-6 lg:p-8">
      <Card className="w-full max-w-xl shadow-lg">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl font-bold text-text-strong">
            Who is using Portfolio Engineering?
          </CardTitle>
          <CardDescription>
            Select a household profile to continue, or create a new profile for a family member.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {deleteSuccessMessage && (
            <Alert>
              <AlertDescription>{deleteSuccessMessage}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8 text-text-muted">
              Loading profiles...
            </div>
          ) : profiles.length === 0 ? (
            <div className="rounded-md border border-dashed border-border-subtle p-6 text-center text-text-muted">
              No profiles found. Create a profile to get started.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="group relative flex flex-col justify-between rounded-lg border border-border-subtle bg-surface-default p-4 text-left transition-all hover:border-action-primary hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(profile.id)}
                    disabled={selectingId !== null}
                    className="flex w-full flex-col items-start focus:outline-none disabled:opacity-50"
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-action-primary/10 text-action-primary font-semibold text-lg group-hover:bg-action-primary group-hover:text-white transition-colors">
                        {profile.displayName.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="font-semibold text-text-strong group-hover:text-action-primary">
                        {profile.displayName}
                      </p>
                      <p className="text-xs text-text-muted truncate max-w-[180px]">
                        {profile.email}
                      </p>
                    </div>
                  </button>

                  <div className="mt-3 flex justify-end border-t border-border-subtle pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-state-error hover:bg-state-error/10 hover:text-state-error"
                      onClick={(e) => {
                        e.stopPropagation()
                        setProfileToDelete(profile)
                        setIsDeleteDialogOpen(true)
                      }}
                      disabled={selectingId !== null}
                    >
                      Delete
                    </Button>
                  </div>

                  {selectingId === profile.id && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-surface-default/80 font-medium text-action-primary">
                      Signing in...
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between border-t border-border-subtle pt-4">
          <Button
            variant="outline"
            onClick={() => setIsModalOpen(true)}
            disabled={selectingId !== null}
            className="w-full sm:w-auto"
          >
            + Add Household Profile
          </Button>
        </CardFooter>
      </Card>

      {/* Modal Dialog for Adding Profile */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Household Profile</DialogTitle>
            <DialogDescription>
              Create a local profile for household members. Password is not required in local mode.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            {createError && (
              <Alert variant="destructive">
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1">
              <label
                htmlFor="displayName"
                className="text-xs font-medium text-text-strong"
              >
                Display Name <span className="text-state-error">*</span>
              </label>
              <Input
                id="displayName"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="e.g. Alex"
                required
                disabled={isCreating}
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="email"
                className="text-xs font-medium text-text-strong"
              >
                Email Address <span className="text-text-muted">(Optional)</span>
              </label>
              <Input
                id="email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="alex@example.com (or leave blank)"
                disabled={isCreating}
              />
              <p className="text-[11px] text-text-muted">
                If left blank, a synthetic local address (&lt;slug&gt;@local.invalid) will be assigned.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || !newDisplayName.trim()}>
                {isCreating ? 'Creating...' : 'Create & Select'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog for Deleting Profile */}
      <DeleteProfileDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        profile={profileToDelete}
        onProfileDeleted={(deletedId) => {
          setProfiles((prev) => prev.filter((p) => p.id !== deletedId))
          setDeleteSuccessMessage('Profile deleted successfully.')
        }}
      />
    </div>
  )
}
