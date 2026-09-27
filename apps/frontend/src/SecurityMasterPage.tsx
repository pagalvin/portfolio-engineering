import { useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type * as React from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import type {
  SecurityRecord,
  SecurityType,
  SecurityWriteRequest,
} from '@portfolio-engineering/shared-types/securityMaster'
import { ApiClientContext } from './apiClientContext'
import type { ApiError } from './apiClient'
import {
  getExchangeDropdownChoices,
  getExchangeFilterChoices,
  getSafeSecurityReturnTo,
  getSecurityDetailPath,
  parseSecurityListQuery,
  securityTypes,
} from './securityMasterApi'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'
import { Textarea } from './components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from './components/ui/dialog'

type Mode = 'list' | 'detail' | 'create' | 'edit'
type FormValues = SecurityWriteRequest
type FormField = keyof FormValues
type FieldErrors = Partial<Record<FormField, string>>

function emptySecurityForm(): FormValues {
  return {
    symbol: '', name: '', description: '', exchange: '', sector: '', industry: '',
  }
}

function errorMessage(error: unknown, fallback: string): string {
  const apiError = error as Partial<ApiError>
  return typeof apiError.message === 'string' ? apiError.message : fallback
}

function apiFieldErrors(error: unknown): FieldErrors {
  const apiError = error as Partial<ApiError>
  if (apiError.code === 'SECURITY_DUPLICATE_IDENTITY') {
    return {
      symbol: 'This symbol is already used with this exchange.',
      exchange: 'This exchange conflicts with an existing security using this symbol.',
    }
  }
  if (apiError.code !== 'VALIDATION_ERROR' || typeof apiError.message !== 'string') return {}

  const formFields: readonly FormField[] = ['symbol', 'type', 'name', 'description', 'exchange', 'sector', 'industry']
  const errors: FieldErrors = {}
  for (const part of apiError.message.split(';')) {
    const match = part.trim().match(/^([a-z]+):\s*(.+)$/i)
    const field = match?.[1]?.toLowerCase()
    if (field && formFields.includes(field as FormField) && match?.[2]) {
      errors[field as FormField] = match[2]
    }
  }
  return errors
}

function focusFirstInvalidField(errors: FieldErrors): void {
  const firstInvalidField = (['symbol', 'type', 'name', 'exchange', 'sector', 'industry', 'description'] as const)
    .find((field) => errors[field])
  if (firstInvalidField) document.getElementById(`security-${firstInvalidField}`)?.focus()
}

function listUrl(searchParams: URLSearchParams): string {
  const query = searchParams.toString()
  return `/workspace/security-master${query ? `?${query}` : ''}`
}

function formatValue(value: string | null | undefined): string {
  return value?.trim() || 'Not provided'
}

function SecurityCountStatus({ shown, total }: { shown: number; total: number }) {
  return (
    <p className="mt-3 border-t border-border-subtle pt-3 text-sm text-text-muted" role="status">
      Showing {shown.toLocaleString()} of {total.toLocaleString()} {total === 1 ? 'security' : 'securities'}
    </p>
  )
}

export function SecurityMasterPage({ mode }: { mode: Mode }) {
  const apiClient = useContext(ApiClientContext)
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { securityId } = useParams()
  const [record, setRecord] = useState<SecurityRecord | null>(null)
  const [loadedSecurityId, setLoadedSecurityId] = useState<string | null>(null)
  const [loadErrorId, setLoadErrorId] = useState<string | null>(null)
  const [records, setRecords] = useState<SecurityRecord[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState<FormValues>(emptySecurityForm)
  const parsedList = useMemo(() => parseSecurityListQuery(location.search), [location.search])
  const returnTo = getSafeSecurityReturnTo(searchParams.get('returnTo'))
  const exchangeFilterChoices = getExchangeFilterChoices(searchParams.get('exchange') ?? '')
  const editRecordLoaded = Boolean(securityId && loadedSecurityId === securityId && record)
  const editLoadError = loadErrorId === securityId ? error : null
  const editLoading = Boolean(securityId && (loading || (!editRecordLoaded && !editLoadError)))

  useLayoutEffect(() => {
    if (mode !== 'create') return
    setRecord(null)
    setLoadedSecurityId(null)
    setMutationError(null)
    setForm(emptySecurityForm())
  }, [mode])

  useEffect(() => {
    const controller = new AbortController()
    if (!apiClient) {
      setError('The security service is unavailable.')
      setLoadErrorId(securityId ?? null)
      setLoading(false)
      return () => controller.abort()
    }
    setLoading(true)
    setError(null)
    setLoadErrorId(null)
    const load = async () => {
      try {
        if (mode === 'list') {
          if (parsedList.error) {
            setLoading(false)
            return
          }
          const response = await apiClient.listSecurities(parsedList.query, controller.signal)
          if (controller.signal.aborted) return
          setRecords(response.securities)
          setTotalCount(response.totalCount)
        } else if (securityId) {
          const next = (await apiClient.getSecurity(securityId, controller.signal)).security
          if (controller.signal.aborted) return
          setRecord(next)
          setLoadedSecurityId(securityId)
          setForm({
            symbol: next.symbol, type: next.type, name: next.name ?? '', description: next.description ?? '',
            exchange: next.exchange ?? '', sector: next.sector ?? '', industry: next.industry ?? '',
          })
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(errorMessage(loadError, 'Unable to load security data.'))
          setLoadErrorId(securityId ?? null)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [apiClient, mode, securityId, parsedList, loadAttempt])

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const navigateToList = () => navigate(returnTo)
  const detailPath = (id: string) => getSecurityDetailPath(id, returnTo)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMutationError(null)
    setFieldErrors({})
    if (mode === 'edit' && (!record || loadedSecurityId !== securityId || loading || error || !securityId)) return
    if (!form.symbol?.trim()) {
      const errors = { symbol: 'Symbol is required.' }
      setFieldErrors(errors)
      focusFirstInvalidField(errors)
      return
    }
    if (!apiClient) return
    setSaving(true)
    try {
      const input = { ...form, symbol: form.symbol.trim() }
      const response = mode === 'create'
        ? await apiClient.createSecurity(input)
        : await apiClient.updateSecurity(securityId!, input)
      navigate(detailPath(response.security.id), { replace: true })
    } catch (saveError) {
      const errors = apiFieldErrors(saveError)
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors)
        focusFirstInvalidField(errors)
      } else {
        setMutationError(errorMessage(saveError, 'Unable to save this security.'))
      }
    } finally {
      setSaving(false)
    }
  }

  const setActive = async (active: boolean) => {
    if (!apiClient || !securityId) return
    setMutationError(null)
    setSaving(true)
    try {
      setRecord((await apiClient.setSecurityActive(securityId, active)).security)
    } catch (actionError) {
      setMutationError(errorMessage(actionError, 'Unable to update the security status.'))
    } finally {
      setSaving(false)
    }
  }

  const deleteRecord = async () => {
    if (!apiClient || !securityId) return
    setMutationError(null)
    setSaving(true)
    try {
      await apiClient.deleteSecurity(securityId)
      navigateToList()
    } catch (deleteError) {
      setMutationError(errorMessage(deleteError, 'Unable to delete this security.'))
      setConfirmDelete(false)
    } finally {
      setSaving(false)
    }
  }

  if (mode === 'list') {
    return (
      <section className="workspace-content" aria-labelledby="security-master-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="eyebrow">System</p><h1 id="security-master-title" className="text-2xl font-semibold">Security Master</h1><p>Maintain your organization&apos;s securities.</p></div>
          <Button asChild><Link to={`/workspace/security-master/new?returnTo=${encodeURIComponent(getSafeSecurityReturnTo(listUrl(searchParams)))}`}>Add security</Link></Button>
        </div>
        {parsedList.error ? <div className="status-panel error-panel" role="alert"><h2>Invalid filters</h2><p>{parsedList.error}</p><Button variant="outline" className="mt-4" onClick={() => navigate('/workspace/security-master')}>Clear filters</Button></div> : (
          <>
            <form className="status-panel grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]" onSubmit={(event) => event.preventDefault()}>
              <label className="grid gap-1">Search by symbol or name<Input aria-label="Search by symbol or name" value={searchParams.get('q') ?? ''} onChange={(event) => updateFilter('q', event.target.value)} /></label>
              <label className="grid gap-1">Status<Select aria-label="Status" value={searchParams.get('status') ?? 'active'} onChange={(event) => updateFilter('status', event.target.value)}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></Select></label>
              <label className="grid gap-1">Type<Select aria-label="Type" value={searchParams.get('type') ?? ''} onChange={(event) => updateFilter('type', event.target.value)}><option value="">All types</option>{securityTypes.map((type) => <option key={type} value={type}>{type}</option>)}</Select></label>
              <label className="grid gap-1">Exchange<Select aria-label="Exchange" value={searchParams.get('exchange') ?? ''} onChange={(event) => updateFilter('exchange', event.target.value)}>{exchangeFilterChoices.map((choice) => <option key={choice.value || 'all-exchanges'} value={choice.value}>{choice.label}</option>)}</Select></label>
            </form>
            {loading ? <div className="status-panel" role="status">Loading securities...</div> : error ? <div className="status-panel error-panel" role="alert"><h2>Unable to load securities</h2><p>{error}</p><Button className="mt-4" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>            Try again</Button></div> : records.length === 0 ? <div className="status-panel"><h2>{totalCount === 0 ? 'No securities yet' : 'No securities match your filters'}</h2><p>{totalCount === 0 ? 'Add a security to get started.' : 'Clear your filters or adjust your search.'}</p>{totalCount > 0 ? <Button variant="outline" className="mt-4" onClick={() => navigate('/workspace/security-master')}>Clear filters</Button> : null}<SecurityCountStatus shown={0} total={totalCount} /></div> : (
                          <div className="status-panel"><div className="overflow-x-auto"><table className="w-full min-w-[50rem] text-left text-sm"><caption className="sr-only">Security Master results</caption><thead><tr className="border-b border-border-subtle">{['Symbol', 'Name', 'Type', 'Exchange', 'Sector', 'Industry', 'Status', 'Action'].map((heading) => <th key={heading} className="p-3">{heading}</th>)}</tr></thead><tbody>{records.map((item) => <tr key={item.id} className="border-b border-border-subtle transition-colors hover:bg-surface-muted"><td className="p-3 font-semibold">{item.symbol}</td><td className="p-3">{formatValue(item.name)}</td><td className="p-3">{item.type}</td><td className="p-3">{formatValue(item.exchange)}</td><td className="p-3">{formatValue(item.sector)}</td><td className="p-3">{formatValue(item.industry)}</td><td className="p-3">{item.active ? 'Active' : 'Inactive'}</td><td className="p-3"><Link className="text-action-primary underline" to={`/workspace/security-master/${item.id}?returnTo=${encodeURIComponent(listUrl(searchParams))}`}>View</Link></td></tr>)}</tbody></table></div><SecurityCountStatus shown={records.length} total={totalCount} /></div>
            )}
          </>
        )}
      </section>
    )
  }

  if (mode === 'edit' && editLoading) {
    return <section className="workspace-content"><Link className="text-action-primary underline" to={returnTo}>Back to Security Master</Link><div className="status-panel" role="status">Loading security for editing...</div></section>
  }

  if (mode === 'edit' && (editLoadError || !editRecordLoaded)) {
    return <section className="workspace-content"><Link className="text-action-primary underline" to={returnTo}>Back to Security Master</Link><div className="status-panel error-panel" role="alert"><h2>Unable to load security for editing</h2><p>{editLoadError ?? 'Security not found.'}</p><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</Button><Button asChild variant="outline"><Link to={returnTo}>Back to Security Master</Link></Button></div></div></section>
  }

  if (mode === 'create' || mode === 'edit') {
    const initialForm = record ? {
      symbol: record.symbol, type: record.type, name: record.name ?? '', description: record.description ?? '',
      exchange: record.exchange ?? '', sector: record.sector ?? '', industry: record.industry ?? '',
    } : undefined
    const cancelPath = mode === 'edit' && securityId ? detailPath(securityId) : returnTo
    const cancel = () => navigate(cancelPath)
    return <SecurityForm mode={mode} form={form} initialForm={initialForm} setForm={setForm} fieldErrors={fieldErrors} setFieldErrors={setFieldErrors} onClearError={() => setMutationError(null)} saving={saving} error={mutationError} onSubmit={submit} onCancel={cancel} cancelPath={cancelPath} />
  }

  return (
    <section className="workspace-content" aria-labelledby="security-detail-title">
      <Link className="text-action-primary underline" to={returnTo}>Back to Security Master</Link>
      {loading ? <div className="status-panel" role="status">Loading security...</div> : error || !record ? <div className="status-panel error-panel" role="alert"><h2>Unable to load security</h2><p>{error ?? 'Security not found.'}</p></div> : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 id="security-detail-title" className="flex flex-wrap items-baseline gap-x-2 text-2xl font-semibold"><span>{record.symbol}</span><span aria-hidden="true" className="text-text-muted">-</span><span>{formatValue(record.name)}</span><span aria-hidden="true" className="text-text-muted">-</span><span className="text-base font-semibold">{record.active ? 'Active' : 'Inactive'}</span></h1></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to={`/workspace/security-master/${record.id}/edit?returnTo=${encodeURIComponent(returnTo)}`}>Edit</Link></Button><Button variant="outline" disabled={saving} onClick={() => void setActive(!record.active)}>{record.active ? 'Deactivate' : 'Reactivate'}</Button><Button variant="destructive" disabled={saving} onClick={() => setConfirmDelete(true)}>Delete</Button></div></div>
          {mutationError ? <div className="status-panel error-panel" role="alert"><p>{mutationError}</p></div> : null}
          <dl className="status-panel grid gap-1">
            <Detail label="Type" value={record.type} />
            <Detail label="Exchange" value={record.exchange} />
            <Detail label="Sector" value={record.sector} />
            <Detail label="Industry" value={record.industry} />
            <Detail label="Description" value={record.description} preserveWhitespace />
            <Detail label="Status" value={record.active ? 'Active' : 'Inactive'} />
          </dl>
          <footer className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-muted" aria-label="Record timestamps">
            <p><span className="font-semibold">Created:</span> <time dateTime={new Date(record.createdAt).toISOString()}>{new Date(record.createdAt).toLocaleString()}</time></p>
            <p><span className="font-semibold">Updated:</span> <time dateTime={new Date(record.updatedAt).toISOString()}>{new Date(record.updatedAt).toLocaleString()}</time></p>
          </footer>
          <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}><DialogContent><DialogHeader><DialogTitle>Delete {record.symbol}?</DialogTitle><DialogDescription>This permanently removes the security. Deletion is blocked if another business record references it; deactivation remains available.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="destructive" disabled={saving} onClick={() => void deleteRecord()}>Delete permanently</Button></DialogFooter></DialogContent></Dialog>
        </>
      )}
    </section>
  )
}

function Detail({ label, value, preserveWhitespace = false }: { label: string; value: string | null | undefined; preserveWhitespace?: boolean }) {
  const displayValue = preserveWhitespace
    ? (value === null || value === undefined || value.length === 0 ? 'Not provided' : value)
    : formatValue(value)

  return <>
    <div className="grid grid-cols-[minmax(6rem,7rem)_minmax(0,1fr)] items-start gap-x-3 rounded-md px-3 py-2 transition-colors hover:bg-surface-muted sm:grid-cols-[8rem_minmax(0,1fr)]">
      <dt className="text-sm font-semibold text-text-primary">{label}</dt>
      <dd className={preserveWhitespace ? 'whitespace-pre-wrap break-words' : undefined}>{displayValue}</dd>
    </div>
  </>
}

function SecurityFieldError({ id, message }: { id: string; message?: string }) {
  return message ? <span id={id} className="text-sm text-text-danger">{message}</span> : null
}

function ExchangeSelect({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string }) {
  const choices = getExchangeDropdownChoices(value)

  return <label className="grid gap-1">Exchange (optional)
    <Select id="security-exchange" aria-invalid={Boolean(error)} aria-describedby={error ? 'security-exchange-error' : undefined} value={value} onChange={(event) => onChange(event.target.value)}>
      {choices.map((choice) => <option key={choice.value || 'blank'} value={choice.value}>
        {choice.label}
      </option>)}
    </Select>
    <SecurityFieldError id="security-exchange-error" message={error} />
  </label>
}

function SecurityForm({ mode, form, initialForm, setForm, fieldErrors, setFieldErrors, onClearError, saving, error, onSubmit, onCancel, cancelPath }: { mode: 'create' | 'edit'; form: FormValues; initialForm?: FormValues; setForm: React.Dispatch<React.SetStateAction<FormValues>>; fieldErrors: FieldErrors; setFieldErrors: React.Dispatch<React.SetStateAction<FieldErrors>>; onClearError: () => void; saving: boolean; error: string | null; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onCancel: () => void; cancelPath: string }) {
  const field = (key: FormField, value: string | SecurityType) => {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => {
      const next = { ...current }
      delete next[key]
      if (key === 'symbol' || key === 'exchange') {
        delete next.symbol
        delete next.exchange
      }
      return next
    })
    onClearError()
  }
  const isDirty = initialForm
    ? JSON.stringify(form) !== JSON.stringify(initialForm)
    : Object.values(form).some((value) => value !== '' && value !== 'OTHER')
  const cancel = () => {
    if (!isDirty || window.confirm('Discard your unsaved security changes?')) onCancel()
  }
  return <section className="workspace-content" aria-labelledby="security-form-title"><Link className="text-action-primary underline" to={cancelPath} onClick={(event) => { event.preventDefault(); cancel() }}>{mode === 'edit' ? 'Back to security details' : 'Back to Security Master'}</Link><div><p className="eyebrow">System</p><h1 id="security-form-title">{mode === 'create' ? 'Add security' : 'Edit security'}</h1></div><form className="status-panel grid gap-4" onSubmit={onSubmit} noValidate>
    {error ? <div className="error-panel" role="alert"><p>{error}</p></div> : null}
    <label className="grid gap-1">Symbol <Input id="security-symbol" aria-invalid={Boolean(fieldErrors.symbol)} aria-describedby={fieldErrors.symbol ? 'security-symbol-error' : undefined} required value={form.symbol} onChange={(event) => field('symbol', event.target.value)} /><SecurityFieldError id="security-symbol-error" message={fieldErrors.symbol} /></label>
    <label className="grid gap-1">Type<Select id="security-type" aria-invalid={Boolean(fieldErrors.type)} aria-describedby={fieldErrors.type ? 'security-type-error' : undefined} value={form.type ?? ''} onChange={(event) => { const selectedType = securityTypes.find((type) => type === event.target.value); setForm((current) => { const next = { ...current }; delete next.type; if (selectedType) next.type = selectedType; return next }); setFieldErrors((current) => { const next = { ...current }; delete next.type; return next }); onClearError() }}><option value="">Select type (optional)</option>{securityTypes.map((type) => <option key={type} value={type}>{type}</option>)}</Select><SecurityFieldError id="security-type-error" message={fieldErrors.type} /></label>
    <label className="grid gap-1">Name<Input id="security-name" aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'security-name-error' : undefined} value={form.name ?? ''} onChange={(event) => field('name', event.target.value)} /><SecurityFieldError id="security-name-error" message={fieldErrors.name} /></label>
    <ExchangeSelect value={form.exchange ?? ''} error={fieldErrors.exchange} onChange={(value) => field('exchange', value)} />
    <label className="grid gap-1">Sector<Input id="security-sector" aria-invalid={Boolean(fieldErrors.sector)} aria-describedby={fieldErrors.sector ? 'security-sector-error' : undefined} value={form.sector ?? ''} onChange={(event) => field('sector', event.target.value)} /><SecurityFieldError id="security-sector-error" message={fieldErrors.sector} /></label>
    <label className="grid gap-1">Industry<Input id="security-industry" aria-invalid={Boolean(fieldErrors.industry)} aria-describedby={fieldErrors.industry ? 'security-industry-error' : undefined} value={form.industry ?? ''} onChange={(event) => field('industry', event.target.value)} /><SecurityFieldError id="security-industry-error" message={fieldErrors.industry} /></label>
    <label className="grid gap-1">Description<Textarea id="security-description" aria-invalid={Boolean(fieldErrors.description)} aria-describedby={fieldErrors.description ? 'security-description-error' : undefined} value={form.description ?? ''} onChange={(event) => field('description', event.target.value)} /><SecurityFieldError id="security-description-error" message={fieldErrors.description} /></label>
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save security'}</Button><Button type="button" variant="outline" onClick={cancel}>Cancel</Button></div>
  </form></section>
}
