import { useContext, useEffect, useState } from 'react'
import { ApiClientContext } from './App'
import {
  fetchInvestorProfile,
  fetchInvestorProfileCatalogs,
  updateInvestorProfile,
  type ExperienceLevel,
  type InvestorProfileCatalogs,
  type InvestorProfileRecord,
  type UpsertInvestorProfileInput,
} from './investorProfileApi'

const PORTFOLIO_CONTEXT_OPTIONS = [
  { id: 'TAXABLE', label: 'Taxable Account' },
  { id: 'RETIREMENT_IRA', label: 'Retirement / IRA Account' },
  { id: 'LIMITED_CAPITAL', label: 'Limited Capital Account' },
  { id: 'OTHER', label: 'Other Account Type' },
]

export function InvestorProfilePage() {
  const apiClient = useContext(ApiClientContext)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [profile, setProfile] = useState<InvestorProfileRecord | null>(null)
  const [catalogs, setCatalogs] = useState<InvestorProfileCatalogs | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Form states
  const [preferredName, setPreferredName] = useState('')
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | ''>('')
  const [portfolioContext, setPortfolioContext] = useState<string[]>([])
  const [primaryObjective, setPrimaryObjective] = useState('')
  const [strategyPresets, setStrategyPresets] = useState<string[]>([])
  const [customStrategyDescription, setCustomStrategyDescription] = useState('')
  const [freeformAiContext, setFreeformAiContext] = useState('')

  // Preview toggles
  const [showStrategyPreview, setShowStrategyPreview] = useState(false)
  const [showAiContextPreview, setShowAiContextPreview] = useState(false)

  useEffect(() => {
    if (!apiClient) return

    let isMounted = true
    setLoading(true)

    Promise.all([
      fetchInvestorProfile(apiClient),
      fetchInvestorProfileCatalogs(apiClient),
    ])
      .then(([{ profile: fetchedProfile }, { catalogs: fetchedCatalogs }]) => {
        if (!isMounted) return
        setCatalogs(fetchedCatalogs)
        setProfile(fetchedProfile)

        if (fetchedProfile) {
          populateForm(fetchedProfile)
          setIsEditing(false)
        } else {
          setIsEditing(true)
        }
        setLoading(false)
      })
      .catch((err) => {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : 'Failed to load investor profile')
        setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [apiClient])

  function populateForm(record: InvestorProfileRecord) {
    setPreferredName(record.preferredName ?? '')
    setExperienceLevel(record.experienceLevel ?? '')
    setPortfolioContext(Array.isArray(record.portfolioContext) ? [...record.portfolioContext] : [])
    setPrimaryObjective(record.primaryObjective ?? '')
    setStrategyPresets(Array.isArray(record.strategyPresets) ? [...record.strategyPresets] : [])
    setCustomStrategyDescription(record.customStrategyDescription ?? '')
    setFreeformAiContext(record.freeformAiContext ?? '')
  }

  function handlePortfolioContextToggle(id: string) {
    setPortfolioContext((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  function handleStrategyPresetToggle(id: string) {
    setStrategyPresets((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!apiClient) return

    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    const payload: UpsertInvestorProfileInput = {
      preferredName: preferredName.trim() || null,
      experienceLevel: (experienceLevel as ExperienceLevel) || null,
      portfolioContext: portfolioContext.length > 0 ? portfolioContext : null,
      primaryObjective: primaryObjective || null,
      strategyPresets: strategyPresets.length > 0 ? strategyPresets : null,
      customStrategyDescription: customStrategyDescription.trim() || null,
      freeformAiContext: freeformAiContext.trim() || null,
    }

    try {
      const { profile: updated } = await updateInvestorProfile(apiClient, payload)
      setProfile(updated)
      populateForm(updated)
      setIsEditing(false)
      setSuccessMessage('Investor profile saved successfully.')
      // Notify window event so alert banner hides immediately
      window.dispatchEvent(new Event('investor-profile-updated'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save investor profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="status-panel">
        <p>Loading investor profile...</p>
      </div>
    )
  }

  const selectedObjectiveObj = catalogs?.objectives.find((obj) => obj.id === profile?.primaryObjective)

  return (
    <div className="investor-profile-container">
      {error && (
        <div className="status-panel error-panel mb-4" role="alert">
          <p className="text-red-500 font-medium">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="status-panel success-panel mb-4" role="status">
          <p className="text-green-600 font-medium">{successMessage}</p>
        </div>
      )}

      {!isEditing && profile ? (
        <div className="status-panel summary-card">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="eyebrow">Durable AI Context</p>
              <h3 className="text-xl font-bold">My Investor Profile</h3>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                populateForm(profile)
                setIsEditing(true)
                setSuccessMessage(null)
              }}
            >
              Edit Profile
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <span className="font-semibold text-gray-700">Preferred Name: </span>
              <span>{profile.preferredName || 'Not specified'}</span>
            </div>

            <div>
              <span className="font-semibold text-gray-700">Experience Level: </span>
              <span>{profile.experienceLevel || 'Not specified'}</span>
            </div>

            <div>
              <span className="font-semibold text-gray-700">Account / Portfolio Context: </span>
              <span>
                {profile.portfolioContext && profile.portfolioContext.length > 0
                  ? profile.portfolioContext.map((id) => PORTFOLIO_CONTEXT_OPTIONS.find((opt) => opt.id === id)?.label || id).join(', ')
                  : 'Not specified'}
              </span>
            </div>

            <div>
              <span className="font-semibold text-gray-700">Primary Objective: </span>
              <span>{selectedObjectiveObj?.title || profile.primaryObjective || 'Not specified'}</span>
              {selectedObjectiveObj?.description && (
                <p className="text-sm text-gray-600 mt-1">{selectedObjectiveObj.description}</p>
              )}
            </div>

            <div>
              <span className="font-semibold text-gray-700">Option Strategies: </span>
              <span>
                {profile.strategyPresets && profile.strategyPresets.length > 0
                  ? profile.strategyPresets
                      .map((id) => catalogs?.strategies.find((s) => s.id === id)?.title || id)
                      .join(', ')
                  : 'Not specified'}
              </span>
            </div>

            {profile.customStrategyDescription && (
              <div>
                <span className="font-semibold text-gray-700 block mb-1">Custom Strategy Description & Overlay:</span>
                <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap font-mono">
                  {profile.customStrategyDescription}
                </div>
              </div>
            )}

            {profile.freeformAiContext && (
              <div>
                <span className="font-semibold text-gray-700 block mb-1">Free-Form Additional AI Context:</span>
                <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap font-mono">
                  {profile.freeformAiContext}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="status-panel space-y-6">
          <div className="flex justify-between items-center pb-2 border-b">
            <div>
              <p className="eyebrow">Personal Trading Context</p>
              <h3 className="text-xl font-bold">Edit Investor Profile</h3>
              <p className="text-sm text-gray-600">
                All fields are 100% voluntary. The AI will use this context to personalize its analysis of your journal entries.
              </p>
            </div>
            {profile && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
            )}
          </div>

          {/* Section 1: Identity & Experience */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg border-b pb-1">1. Identity & Experience</h4>
            <div>
              <label htmlFor="preferredName" className="block text-sm font-medium mb-1">
                Preferred Name / Handle
              </label>
              <input
                id="preferredName"
                type="text"
                className="input text-input w-full max-w-md"
                placeholder="e.g. Alex"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                How the app and AI address you in conversation and coaching notes.
              </p>
            </div>

            <div>
              <label htmlFor="experienceLevel" className="block text-sm font-medium mb-1">
                Options Experience Level
              </label>
              <select
                id="experienceLevel"
                className="input select-input w-full max-w-md"
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel | '')}
              >
                <option value="">-- Select Experience Level (Optional) --</option>
                <option value="BEGINNER">Beginner / Learning</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="EXPERIENCED">Experienced</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Helps the AI adjust its coaching depth and inline terminology explanations.
              </p>
            </div>

            <div>
              <span className="block text-sm font-medium mb-1">Account / Portfolio Context</span>
              <div className="space-y-2">
                {PORTFOLIO_CONTEXT_OPTIONS.map((opt) => (
                  <label key={opt.id} className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={portfolioContext.includes(opt.id)}
                      onChange={() => handlePortfolioContextToggle(opt.id)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Primary Investment Objective */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg border-b pb-1">2. Primary Investment Objective</h4>
            <p className="text-xs text-gray-500">
              Why we ask this: AI uses your primary goal to highlight trades or thesis points that diverge from your intended direction.
            </p>

            <div className="space-y-2">
              {catalogs?.objectives.map((obj) => (
                <label key={obj.id} className="flex items-start space-x-2 text-sm p-2 rounded hover:bg-gray-50 border">
                  <input
                    type="radio"
                    name="primaryObjective"
                    value={obj.id}
                    checked={primaryObjective === obj.id}
                    onChange={(e) => setPrimaryObjective(e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-medium block">{obj.title}</span>
                    <span className="text-gray-600 block text-xs">{obj.description}</span>
                    {obj.educationalHint && (
                      <span className="text-blue-600 block text-xs italic mt-0.5">{obj.educationalHint}</span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Section 3: Strategies & Custom Description */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg border-b pb-1">3. Strategies & Custom Description</h4>
            <div>
              <span className="block text-sm font-medium mb-1">Standard Options Strategies You Trade</span>
              <div className="space-y-2">
                {catalogs?.strategies.map((strat) => (
                  <label key={strat.id} className="flex items-start space-x-2 text-sm p-2 rounded hover:bg-gray-50 border">
                    <input
                      type="checkbox"
                      checked={strategyPresets.includes(strat.id)}
                      onChange={() => handleStrategyPresetToggle(strat.id)}
                      className="mt-1"
                    />
                    <div>
                      <span className="font-medium block">{strat.title}</span>
                      <span className="text-gray-600 block text-xs">{strat.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="customStrategyDescription" className="block text-sm font-medium">
                  Custom Strategy & Overlay Description (Markdown)
                </label>
                <button
                  type="button"
                  className="text-xs text-blue-600 underline"
                  onClick={() => setShowStrategyPreview((prev) => !prev)}
                >
                  {showStrategyPreview ? 'Edit' : 'Preview'}
                </button>
              </div>

              {showStrategyPreview ? (
                <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap border min-h-[100px]">
                  {customStrategyDescription || 'Nothing to preview.'}
                </div>
              ) : (
                <textarea
                  id="customStrategyDescription"
                  rows={4}
                  className="input textarea-input w-full font-mono text-sm"
                  placeholder="e.g. I sell deep ITM covered calls on high-conviction value stocks for downside protection, using a buy/write/decide overlay at expiration."
                  value={customStrategyDescription}
                  onChange={(e) => setCustomStrategyDescription(e.target.value)}
                />
              )}
              <p className="text-xs text-gray-500 mt-1">
                Describe your specific setup, entry criteria, or strategy overlays in your own words.
              </p>
            </div>
          </div>

          {/* Section 4: Free-Form Additional Context */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg border-b pb-1">4. Free-Form Additional AI Context</h4>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="freeformAiContext" className="block text-sm font-medium">
                  Free-Form Additional Notes for AI (Markdown)
                </label>
                <button
                  type="button"
                  className="text-xs text-blue-600 underline"
                  onClick={() => setShowAiContextPreview((prev) => !prev)}
                >
                  {showAiContextPreview ? 'Edit' : 'Preview'}
                </button>
              </div>

              {showAiContextPreview ? (
                <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap border min-h-[100px]">
                  {freeformAiContext || 'Nothing to preview.'}
                </div>
              ) : (
                <textarea
                  id="freeformAiContext"
                  rows={4}
                  className="input textarea-input w-full font-mono text-sm"
                  placeholder="e.g. This is a tax-advantaged Roth IRA account. I never use margin or leverage. My main focus this quarter is keeping position size under 15%."
                  value={freeformAiContext}
                  onChange={(e) => setFreeformAiContext(e.target.value)}
                />
              )}
              <p className="text-xs text-gray-500 mt-1">
                Passed to the AI when analyzing journal entries. Use this space for any personal guidelines, life context, tax considerations, or rules.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t flex justify-end space-x-3">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Investor Profile'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
