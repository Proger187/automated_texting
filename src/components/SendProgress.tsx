import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import type { SendResultEntry } from '../store/appStore'
import { render as renderTemplate } from '../services/templateEngine'
import type { ProgressPayload } from '../types/ipc'

// Per-adapter reasonable defaults — overridden by Module 8 settings panel
const DEFAULT_DELAYS: Record<string, number> = {
  whatsapp: 4000,
  telegram: 1000,
  email: 500,
}

interface Props {
  // reads entirely from Zustand store; no required props
}

export default function SendProgress(_props: Props): JSX.Element {
  const sendState  = useAppStore((s) => s.sendState)
  const contacts   = useAppStore((s) => s.contacts)
  const contactField = useAppStore((s) => s.contactField)
  const setSendState = useAppStore((s) => s.setSendState)

  const { status, results, successCount, failCount } = sendState
  const displayTotal = sendState.total > 0 ? sendState.total : contacts.length
  const pending      = Math.max(0, displayTotal - results.length)
  const progressPct  = displayTotal > 0 ? (results.length / displayTotal) * 100 : 0

  // ── Register IPC progress listener once on mount ────────────────────────────
  useEffect(() => {
    if (!window.electronAPI) return
    const unsubscribe = window.electronAPI.onProgress((payload: ProgressPayload) => {
      // Use getState() to avoid stale closure — safe for event callbacks
      const state = useAppStore.getState()

      const contactRow = state.contacts.find(
        (c) => c[state.contactField] === payload.contact
      )
      const renderedMessage = contactRow
        ? renderTemplate(state.template, contactRow)
        : ''
      const timestamp = new Date().toISOString()

      const newEntry: SendResultEntry = {
        contact: payload.contact,
        success: payload.success,
        error: payload.error,
        renderedMessage,
        timestamp,
      }

      const currentResults = useAppStore.getState().sendState.results
      const newResults = [...currentResults, newEntry]

      state.setSendState({
        index: payload.index,
        total: payload.total,
        results: newResults,
        successCount: newResults.filter((r) => r.success).length,
        failCount: newResults.filter((r) => !r.success).length,
        status: payload.done ? 'completed' : 'running',
      })
    })

    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — uses getState() inside to avoid stale reads

  // ── Start the send run ──────────────────────────────────────────────────────
  async function handleStart(): Promise<void> {
    const state = useAppStore.getState()

    // Load persisted settings so we use the user's configured delay and country code
    let delayMs = DEFAULT_DELAYS[state.adapterType] ?? 1000
    let defaultCountryCode: string | undefined
    let concurrency: number | undefined
    let interMessageDelayMs: number | undefined
    let delayMin: number | undefined
    let delayMax: number | undefined

    if (window.electronAPI) {
      try {
        const settings = await window.electronAPI.loadSettings()
        if (settings.delayMs > 0) delayMs = settings.delayMs
        if (settings.defaultCountryCode) defaultCountryCode = settings.defaultCountryCode
        if (settings.concurrency > 1) concurrency = settings.concurrency
        if (settings.interMessageDelayMs !== undefined) interMessageDelayMs = settings.interMessageDelayMs
        if (settings.delayMin !== undefined) delayMin = settings.delayMin
        if (settings.delayMax !== undefined) delayMax = settings.delayMax
      } catch {
        // silently fall back to defaults
      }
    }

    // Load credentials from the selected account (if any)
    let credentials: unknown = state.credentials
    let adapterType = state.adapterType
    if (window.electronAPI && state.selectedAccountId) {
      try {
        const account = await window.electronAPI.getAccount(state.selectedAccountId)
        if (account) {
          credentials = account.credentials
          adapterType = account.type
        }
      } catch {
        // fall back to store credentials
      }
    }

    const emailSubject = state.emailSubject

    state.setSendState({
      status: 'running',
      index: 0,
      total: state.contacts.length,
      results: [],
      successCount: 0,
      failCount: 0,
    })

    if (window.electronAPI) {
      void window.electronAPI.sendMessages({
        contacts: state.contacts,
        contactField: state.contactField,
        template: state.template,
        messageSequence: state.messageSequence,
        adapterType,
        credentials,
        delayMs,
        defaultCountryCode,
        concurrency,
        emailSubject: emailSubject || undefined,
        interMessageDelayMs,
        delayMin,
        delayMax,
      })
    }
  }

  function handlePause(): void {
    if (window.electronAPI) window.electronAPI.pauseSend()
    setSendState({ status: 'paused' })
  }

  function handleResume(): void {
    if (window.electronAPI) window.electronAPI.resumeSend()
    setSendState({ status: 'running' })
  }

  function handleCancel(): void {
    if (window.electronAPI) window.electronAPI.cancelSend()
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* ── Idle state: pre-send summary ─────────────────────────────────── */}
      {status === 'idle' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4 shadow-sm">
          <div className="text-5xl">📤</div>
          <h3 className="text-xl font-semibold text-gray-800">Ready to send</h3>
          <p className="text-gray-500 text-sm">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''} loaded
          </p>
          {contacts.length === 0 ? (
            <p className="text-amber-600 text-sm font-medium">
              ⚠ No contacts imported. Go back to Step 1.
            </p>
          ) : (
            <button
              onClick={() => void handleStart()}
              className="mt-2 inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              ▶ Start Sending
            </button>
          )}
        </div>
      )}

      {/* ── Active / paused state ─────────────────────────────────────────── */}
      {(status === 'running' || status === 'paused') && (
        <>
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600 font-medium">
              <span>{results.length} of {displayTotal} sent</span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full bg-violet-600 transition-all duration-300 ease-in-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Counters */}
          <div className="flex gap-4">
            <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{successCount}</div>
              <div className="text-xs text-green-600 font-medium mt-0.5">Sent</div>
            </div>
            <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-700">{failCount}</div>
              <div className="text-xs text-red-600 font-medium mt-0.5">Failed</div>
            </div>
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-600">{pending}</div>
              <div className="text-xs text-gray-500 font-medium mt-0.5">Pending</div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-3">
            {status === 'running' ? (
              <button
                onClick={handlePause}
                className="flex items-center gap-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
              >
                ⏸ Pause
              </button>
            ) : (
              <button
                onClick={handleResume}
                className="flex items-center gap-1.5 bg-green-100 hover:bg-green-200 text-green-800 font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
              >
                ▶ Resume
              </button>
            )}
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-800 font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
            >
              ✕ Cancel
            </button>
            {status === 'paused' && (
              <span className="ml-2 inline-flex items-center text-amber-700 text-sm font-medium">
                ⏸ Paused
              </span>
            )}
          </div>

          {/* Scrollable contact list */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
              Contact status
            </div>
            <ul className="max-h-72 overflow-y-auto divide-y divide-gray-100">
              {contacts.map((row, i) => {
                const result: SendResultEntry | undefined = results[i]
                const isPending = i >= results.length

                return (
                  <li
                    key={i}
                    className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm"
                  >
                    <span className="mt-0.5 shrink-0 text-base leading-none">
                      {isPending ? '⏳' : result?.success ? '✅' : '❌'}
                    </span>
                    <span className="flex-1 break-all text-gray-800">
                      {row[contactField] || '—'}
                    </span>
                    {result && !result.success && result.error && (
                      <span className="text-red-500 text-xs max-w-[40%] text-right">
                        {result.error}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
