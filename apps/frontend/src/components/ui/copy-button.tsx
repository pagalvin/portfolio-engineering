import * as React from 'react'

import { Button, type ButtonProps } from './button'

export interface CopyButtonProps
  extends Omit<ButtonProps, 'children' | 'onClick'> {
  onCopyAction: () => Promise<boolean>
  label?: string
  copiedLabel?: string
  feedbackDuration?: number
  icon?: React.ReactNode
}

/**
 * A reusable copy action with brief, visible success feedback.
 *
 * Callers retain ownership of copy failures so they can surface the
 * appropriate context-specific error message.
 */
function CopyButton({
  onCopyAction,
  label = 'Copy to Clipboard',
  copiedLabel = 'Copied!',
  feedbackDuration = 2500,
  icon,
  disabled,
  ...buttonProps
}: CopyButtonProps) {
  const [isCopying, setIsCopying] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const resetTimerRef = React.useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const actionIdRef = React.useRef(0)

  React.useEffect(() => {
    return () => {
      actionIdRef.current += 1

      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  const handleClick = async () => {
    const actionId = ++actionIdRef.current

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }

    setCopied(false)
    setIsCopying(true)

    let succeeded = false
    try {
      succeeded = await onCopyAction()
    } catch {
      // The caller owns context-specific failure feedback.
    }

    if (actionIdRef.current !== actionId) {
      return
    }

    setIsCopying(false)

    if (!succeeded) {
      return
    }

    setCopied(true)
    resetTimerRef.current = window.setTimeout(() => {
      if (actionIdRef.current === actionId) {
        setCopied(false)
        resetTimerRef.current = null
      }
    }, feedbackDuration)
  }

  const buttonLabel = isCopying ? 'Copying...' : copied ? copiedLabel : label

  return (
    <>
      <Button
        {...buttonProps}
        disabled={disabled || isCopying}
        onClick={() => {
          void handleClick()
        }}
      >
        {icon}
        {buttonLabel}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? 'Copied to clipboard.' : ''}
      </span>
    </>
  )
}

export { CopyButton }
