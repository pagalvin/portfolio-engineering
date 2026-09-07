import React, { useState, useEffect } from 'react'
import type {
  HouseholdProfile,
  ProfileBackupPayload,
  DeleteProfileResponse,
} from '@portfolio-engineering/shared-types/auth'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Alert, AlertDescription } from './ui/alert'
import {
  fetchLocalProfileBackup,
  deleteLocalProfile,
  downloadProfileBackupJson,
} from '../authSession'

export interface DeleteProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: HouseholdProfile | null
  onProfileDeleted: (profileId: string) => Promise<void> | void
  exportBackupFn?: (profileId: string) => Promise<ProfileBackupPayload>
  deleteProfileFn?: (profileId: string) => Promise<DeleteProfileResponse>
}

export const DeleteProfileDialog: React.FC<DeleteProfileDialogProps> = ({
  open,
  onOpenChange,
  profile,
  onProfileDeleted,
  exportBackupFn,
  deleteProfileFn,
}) => {
  const [confirmationInput, setConfirmationInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setConfirmationInput('')
      setError(null)
      setIsProcessing(false)
    }
  }, [open, profile?.id])

  if (!profile) {
    return null
  }

  const trimmedInput = confirmationInput.trim().toLowerCase()
  const matchesDisplayName =
    trimmedInput.length > 0 &&
    trimmedInput === profile.displayName.trim().toLowerCase()
  const matchesEmail =
    trimmedInput.length > 0 &&
    trimmedInput === profile.email.trim().toLowerCase()
  const isConfirmed = matchesDisplayName || matchesEmail

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isConfirmed || isProcessing) {
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      // Step 1: Generate & download backup
      let backup: ProfileBackupPayload
      try {
        if (exportBackupFn) {
          backup = await exportBackupFn(profile.id)
        } else {
          backup = await fetchLocalProfileBackup(profile.id)
        }
      } catch (backupErr) {
        const msg =
          backupErr instanceof Error
            ? backupErr.message
            : 'Could not generate backup.'
        setError(`${msg} Deletion was aborted to protect your data.`)
        setIsProcessing(false)
        return
      }

      // Step 2: Trigger browser download
      downloadProfileBackupJson(backup)

      // Step 3: Delete profile in backend
      try {
        if (deleteProfileFn) {
          await deleteProfileFn(profile.id)
        } else {
          await deleteLocalProfile(profile.id)
        }
      } catch (deleteErr) {
        const msg =
          deleteErr instanceof Error
            ? deleteErr.message
            : 'Server failed to delete profile.'
        setError(`Backup downloaded, but ${msg} Please try again.`)
        setIsProcessing(false)
        return
      }

      // Step 4: Callback and close
      await onProfileDeleted(profile.id)
      onOpenChange(false)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" role="alertdialog">
        <form onSubmit={handleDelete}>
          <DialogHeader>
            <DialogTitle>Delete Profile: {profile.displayName}</DialogTitle>
            <DialogDescription>
              Permanently remove this profile and all associated data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertDescription>
                <strong>Warning:</strong> This action cannot be undone. All journal
                entries and investor profile settings for{' '}
                <strong>{profile.displayName}</strong> will be permanently deleted.
              </AlertDescription>
            </Alert>

            <div className="rounded-md border border-border-subtle bg-surface-muted p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-text-muted">Display Name:</span>
                <span className="font-medium text-text-strong">{profile.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Email:</span>
                <span className="font-medium text-text-strong">{profile.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Journal Entries:</span>
                <span className="font-medium text-text-strong">
                  {profile.journalEntryCount ?? 0} entries
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Investor Profile:</span>
                <span className="font-medium text-text-strong">
                  {profile.hasInvestorProfile ? 'Configured' : 'Not configured'}
                </span>
              </div>
            </div>

            <p className="text-xs text-text-muted">
              Before deleting, an uncorrupted, portable backup file will automatically be
              downloaded to your computer as a safety backup.
            </p>

            <div className="space-y-2">
              <label
                htmlFor="confirm-delete-input"
                className="text-sm font-medium text-text-strong"
              >
                Type &quot;{profile.displayName}&quot; or &quot;{profile.email}&quot; to confirm:
              </label>
              <Input
                id="confirm-delete-input"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder={profile.displayName}
                disabled={isProcessing}
                autoFocus
              />
            </div>

            {error && (
              <Alert variant="destructive" aria-live="polite">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!isConfirmed || isProcessing}
            >
              {isProcessing
                ? 'Backing up & Deleting...'
                : 'Download Backup & Delete Profile'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
