import React, { useState, useEffect } from 'react'
import type { HouseholdProfile, ProfilesResponse, AppMode } from '@portfolio-engineering/shared-types/auth'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
} from './ui/dialog'
import { ProfilePicker } from './ProfilePicker'

export interface ProfileSwitcherProps {
  currentDisplayName: string
  currentEmail?: string
  appMode?: AppMode
  onProfileSwitched: () => void
  onSignOut?: () => void
}

export const ProfileSwitcher: React.FC<ProfileSwitcherProps> = ({
  currentDisplayName,
  currentEmail,
  appMode = 'local',
  onProfileSwitched,
  onSignOut,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [profiles, setProfiles] = useState<readonly HouseholdProfile[]>([])

  useEffect(() => {
    if (appMode !== 'local' || !isOpen) {
      return
    }

    async function loadProfiles() {
      try {
        const response = await fetch('/auth/profiles', {
          credentials: 'include',
        })
        if (response.ok) {
          const data = (await response.json()) as ProfilesResponse
          setProfiles(data.profiles)
        }
      } catch {
        // ignore load error
      }
    }

    loadProfiles()
  }, [appMode, isOpen])

  const handleSelectProfile = async (profileId: string) => {
    const response = await fetch('/auth/profiles/select', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId }),
    })

    if (!response.ok) {
      throw new Error('Failed to switch profile')
    }

    setIsOpen(false)
    onProfileSwitched()
  }

  if (appMode === 'hosted') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center space-x-2 rounded-full border border-border-subtle bg-surface-default px-3 py-1.5 text-xs text-text-strong">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-action-primary text-white font-medium">
            {currentDisplayName.charAt(0).toUpperCase()}
          </div>
          <span className="font-semibold">{currentDisplayName}</span>
          {currentEmail && <span className="text-text-muted">({currentEmail})</span>}
        </div>
        {onSignOut ? (
          <Button variant="outline" size="sm" onClick={onSignOut}>
            Use another account
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 border-border-subtle bg-surface-default hover:bg-surface-muted text-text-strong shadow-xs"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-action-primary/10 text-action-primary font-bold text-xs">
          {currentDisplayName.charAt(0).toUpperCase()}
        </div>
        <span className="font-medium text-xs">{currentDisplayName}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5 text-text-muted"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-xl p-0 border-none bg-transparent shadow-none">
          <ProfilePicker
            initialProfiles={profiles.length > 0 ? profiles : undefined}
            onSelectProfile={handleSelectProfile}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
