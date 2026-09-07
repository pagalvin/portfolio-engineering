import { useContext, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ApiClientContext } from '../apiClientContext'
import { fetchInvestorProfile, type InvestorProfileRecord } from '../investorProfileApi'

const DISMISSAL_KEY = 'investor_profile_alert_dismissed'

function isProfileEmpty(profile: InvestorProfileRecord | null): boolean {
  if (!profile) return true

  const hasName = Boolean(profile.preferredName && profile.preferredName.trim().length > 0)
  const hasExp = Boolean(profile.experienceLevel)
  const hasContext = Boolean(profile.portfolioContext && profile.portfolioContext.length > 0)
  const hasObj = Boolean(profile.primaryObjective)
  const hasStrategies = Boolean(profile.strategyPresets && profile.strategyPresets.length > 0)
  const hasCustomDesc = Boolean(profile.customStrategyDescription && profile.customStrategyDescription.trim().length > 0)
  const hasAiContext = Boolean(profile.freeformAiContext && profile.freeformAiContext.trim().length > 0)

  return !(hasName || hasExp || hasContext || hasObj || hasStrategies || hasCustomDesc || hasAiContext)
}

export function EmptyProfileAlert() {
  const apiClient = useContext(ApiClientContext)
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(DISMISSAL_KEY) === 'true'
  })
  const [isEmpty, setIsEmpty] = useState(false)

  useEffect(() => {
    if (!apiClient) return

    let isMounted = true

    function checkProfile() {
      if (!apiClient) return
      fetchInvestorProfile(apiClient)
        .then(({ profile }) => {
          if (!isMounted) return
          setIsEmpty(isProfileEmpty(profile))
        })
        .catch(() => {
          // Ignore network errors for background alert check
        })
    }

    checkProfile()

    const handleUpdate = () => checkProfile()
    window.addEventListener('investor-profile-updated', handleUpdate)

    return () => {
      isMounted = false
      window.removeEventListener('investor-profile-updated', handleUpdate)
    }
  }, [apiClient])

  if (dismissed || !isEmpty) {
    return null
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSAL_KEY, 'true')
    setDismissed(true)
  }

  return (
    <div className="status-panel bg-amber-50 border-amber-200 mb-4 p-4 rounded-md flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-3">
        <span className="text-amber-600 text-lg font-bold">💡</span>
        <div>
          <p className="text-sm font-medium text-amber-900">
            Personalize your AI Journal Analysis
          </p>
          <p className="text-xs text-amber-700">
            You haven't set up your Personal Investor Profile yet.{' '}
            <Link
              to="/workspace/settings/profile"
              className="font-semibold underline text-amber-900 hover:text-amber-950"
            >
              Set up your profile
            </Link>{' '}
            so the AI can provide personalized feedback grounded in your strategy.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss alert"
        className="text-amber-700 hover:text-amber-900 text-sm font-semibold ml-4 px-2 py-1 rounded"
      >
        ✕
      </button>
    </div>
  )
}
