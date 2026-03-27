import React, { useState, useEffect } from 'react'
import ExcelImporter from './components/ExcelImporter'
import AccountsManager from './components/AccountsManager'
import MessageComposer from './components/MessageComposer'
import SendProgress from './components/SendProgress'
import SendLog from './components/SendLog'
import { useAppStore } from './store/appStore'
import { validate } from './services/templateEngine'
import type { CredentialType, AppSettings } from './types/ipc'

// ── Error Boundary ─────────────────────────────────────────────────────────────

interface EBProps {
  children: React.ReactNode
  onReset?: () => void
}
interface EBState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<EBProps, EBState> {
  constructor(props: EBProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[BulkMessenger ErrorBoundary]', error, info)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full p-10">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md text-center shadow-sm">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-lg font-bold text-red-800 mb-2">Something went wrong</h3>
            <p className="text-sm text-red-600 mb-6 font-mono break-all">
              {this.state.error?.message ?? 'Unknown error'}
            </p>
            <button
              onClick={this.handleReset}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              Reset this step
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Constants ──────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4

const STEP_LABELS: Record<Step, string> = {
  1: 'Import',
  2: 'Credentials',
  3: 'Compose',
  4: 'Send',
}

const ADAPTER_LABELS: Record<CredentialType, string> = {
  whatsapp:     'WhatsApp',
  telegram:     'Telegram Bot',
  telegramUser: 'Telegram User',
  email:        'Email / SMTP',
  instagram:    'Instagram',
}

// ── Root component ─────────────────────────────────────────────────────────────

export default function App(): JSX.Element {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [showSettings, setShowSettings] = useState(false)
  const [delayMs, setDelayMs] = useState(0)
  const [defaultCountryCode, setDefaultCountryCode] = useState('')
  const [concurrency, setConcurrency] = useState(1)
  const [interMessageDelayMs, setInterMessageDelayMs] = useState(1500)
  const [darkMode, setDarkMode] = useState(false)

  // ── Store reads ──────────────────────────────────────────────────────────────
  const contacts            = useAppStore((s) => s.contacts)
  const contactField        = useAppStore((s) => s.contactField)
  const filename            = useAppStore((s) => s.filename)
  const template            = useAppStore((s) => s.template)
  const headers             = useAppStore((s) => s.headers)
  const adapterType         = useAppStore((s) => s.adapterType)
  const selectedAccountId   = useAppStore((s) => s.selectedAccountId)
  const sendStatus          = useAppStore((s) => s.sendState.status)
  const setAdapterType      = useAppStore((s) => s.setAdapterType)

  // ── Update document title when filename changes ──────────────────────────────
  useEffect(() => {
    document.title = filename ? `BulkMessenger \u2014 ${filename}` : 'BulkMessenger'
  }, [filename])

  // ── Load settings and dark mode preference on mount ──────────────────────────
  useEffect(() => {
    // window.electronAPI may be undefined when running outside Electron (e.g.
    // plain browser during CI / storybook). Guard against it.
    if (window.electronAPI) {
      window.electronAPI
        .loadSettings()
        .then((s: AppSettings) => {
          setDelayMs(s.delayMs)
          setDefaultCountryCode(s.defaultCountryCode ?? '')
          setConcurrency(s.concurrency ?? 1)
          setInterMessageDelayMs(s.interMessageDelayMs ?? 1500)
        })
        .catch(() => {})
    }

    const dark = localStorage.getItem('bulkmessenger_dark') === 'true'
    setDarkMode(dark)
    if (dark) document.documentElement.classList.add('dark')
  }, [])

  // ── Step validity ────────────────────────────────────────────────────────────
  const step1Valid = contacts.length > 0 && contactField !== ''
  // Step 2 is valid when an account is selected (account type doesn't need to match adapterType strictly)
  const step2Valid = selectedAccountId !== null
  const step3Valid = template.length > 0 && validate(template, headers).length === 0

  const stepValid: Record<Step, boolean> = {
    1: step1Valid,
    2: step2Valid,
    3: step3Valid,
    4: true,
  }

  const isCompleted = (step: Step): boolean => {
    if (step === 4) return sendStatus === 'completed'
    return stepValid[step]
  }

  // ── Settings handlers ────────────────────────────────────────────────────────
  async function handleSaveSettings(): Promise<void> {
    if (window.electronAPI) {
      await window.electronAPI.saveSettings({ delayMs, defaultCountryCode, concurrency, interMessageDelayMs })
    }
    setShowSettings(false)
  }

  function handleDarkToggle(enabled: boolean): void {
    setDarkMode(enabled)
    localStorage.setItem('bulkmessenger_dark', String(enabled))
    if (enabled) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-slate-100 font-sans">
      {/* ──────────── Sidebar ──────────── */}
      <nav className="w-56 bg-indigo-950 text-slate-200 flex flex-col shrink-0">
        {/* Logo + loaded filename */}
        <div className="px-5 pt-7 pb-5 border-b border-indigo-900">
          <h1 className="text-base font-bold text-violet-300 tracking-tight">
            BulkMessenger
          </h1>
          {filename && (
            <p className="text-xs text-indigo-400 mt-1 truncate" title={filename}>
              {filename}
            </p>
          )}
        </div>

        {/* Step buttons */}
        <ul className="flex-1 flex flex-col gap-1 px-3 py-4">
          {([1, 2, 3, 4] as Step[]).map((step) => {
            const active    = currentStep === step
            const completed = isCompleted(step)
            return (
              <li key={step}>
                <button
                  onClick={() => setCurrentStep(step)}
                  className={[
                    'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors text-left',
                    active
                      ? 'bg-violet-600 text-white font-semibold'
                      : 'text-slate-300 hover:bg-indigo-900 font-normal',
                  ].join(' ')}
                >
                  <span className={[
                    'shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors',
                    completed
                      ? 'bg-green-500 text-white'
                      : active
                        ? 'bg-white/20 text-white'
                        : 'bg-white/10 text-slate-400',
                  ].join(' ')}>
                    {completed ? '✓' : step}
                  </span>
                  {STEP_LABELS[step]}
                </button>
              </li>
            )
          })}
        </ul>

        {/* Settings gear button */}
        <div className="px-3 pb-5">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-indigo-900 transition-colors"
          >
            <span className="text-base leading-none">⚙</span>
            Settings
          </button>
        </div>
      </nav>

      {/* ──────────── Settings slide-in panel ──────────── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowSettings(false)}
          />
          <div className="relative ml-auto w-80 h-full bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                aria-label="Close settings"
              >
                ×
              </button>
            </div>

            <div className="flex-1 px-6 py-6 space-y-6 overflow-y-auto">
              {/* Delay */}
              <div>
                <label
                  htmlFor="settings-delay"
                  className="block text-sm font-semibold text-gray-700 mb-1"
                >
                  Delay between messages (ms)
                </label>
                <input
                  id="settings-delay"
                  type="number"
                  min={0}
                  max={60000}
                  value={delayMs}
                  onChange={(e) =>
                    setDelayMs(Math.max(0, parseInt(e.target.value, 10) || 0))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  0 = use adapter default (WhatsApp 4 s · Telegram 1 s · Email 0.5 s)
                </p>
              </div>

              {/* Default country code */}
              <div>
                <label
                  htmlFor="settings-cc"
                  className="block text-sm font-semibold text-gray-700 mb-1"
                >
                  Default country code
                </label>
                <input
                  id="settings-cc"
                  type="text"
                  placeholder="e.g. 996 for Kyrgyzstan"
                  value={defaultCountryCode}
                  onChange={(e) =>
                    setDefaultCountryCode(e.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Prepended to short numbers that are missing a country prefix.
                  Digits only, no +. Leave blank to disable.
                </p>
              </div>

              {/* Concurrency */}
              <div>
                <label
                  htmlFor="settings-concurrency"
                  className="block text-sm font-semibold text-gray-700 mb-1"
                >
                  Parallel sends
                </label>
                <input
                  id="settings-concurrency"
                  type="number"
                  min={1}
                  max={10}
                  value={concurrency}
                  onChange={(e) =>
                    setConcurrency(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  How many messages to send simultaneously (1–10). Higher values
                  speed up bulk runs but may increase the risk of rate-limiting.
                </p>
              </div>

              {/* Inter-message delay */}
              <div>
                <label
                  htmlFor="settings-inter-delay"
                  className="block text-sm font-semibold text-gray-700 mb-1"
                >
                  Inter-message delay (ms)
                </label>
                <input
                  id="settings-inter-delay"
                  type="number"
                  min={0}
                  max={30000}
                  value={interMessageDelayMs}
                  onChange={(e) =>
                    setInterMessageDelayMs(Math.max(0, parseInt(e.target.value, 10) || 0))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Wait time between messages in a sequence for the same contact
                  (default 1500 ms). Only applies when sending multiple messages per contact.
                </p>
              </div>

              {/* Dark mode toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Dark mode</span>
                <button
                  onClick={() => handleDarkToggle(!darkMode)}
                  role="switch"
                  aria-checked={darkMode}
                  className={[
                    'relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500',
                    darkMode ? 'bg-violet-600' : 'bg-gray-300',
                  ].join(' ')}
                >
                  <span className={[
                    'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                    darkMode ? 'translate-x-5' : 'translate-x-0',
                  ].join(' ')} />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 border-t border-gray-200">
              <button
                onClick={() => void handleSaveSettings()}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
              >
                Save settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────── Main content ──────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-9 py-5 shrink-0">
          <p className="text-xs font-semibold text-violet-600 uppercase tracking-widest mb-1">
            Step {currentStep} of 4
          </p>
          <h2 className="text-2xl font-bold text-indigo-950">
            {STEP_LABELS[currentStep]}
          </h2>
        </header>

        {/* Adapter type selector — only shown at top of Step 2 */}
        {currentStep === 2 && (
          <div className="bg-white border-b border-gray-100 px-9 py-3 shrink-0 flex items-center gap-4">
            <span className="text-sm font-semibold text-gray-600">Send via:</span>
            <div className="flex gap-2">
              {(['whatsapp', 'telegramUser', 'email', 'instagram'] as CredentialType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setAdapterType(type)}
                  className={[
                    'px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors',
                    adapterType === type
                      ? 'bg-violet-600 border-violet-600 text-white'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-violet-400',
                  ].join(' ')}
                >
                  {ADAPTER_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Scrollable step content wrapped in per-step ErrorBoundary */}
        <div className="flex-1 overflow-y-auto">
          <ErrorBoundary key={currentStep} onReset={() => {}}>
            {currentStep === 1 && <ExcelImporter />}
            {currentStep === 2 && <AccountsManager lockedType={adapterType} />}
            {currentStep === 3 && <MessageComposer />}
            {currentStep === 4 && (
              sendStatus === 'completed' ? <SendLog /> : <SendProgress />
            )}
          </ErrorBoundary>
        </div>

        {/* Footer navigation */}
        <footer className="bg-white border-t border-gray-200 px-9 py-4 flex justify-between items-center shrink-0">
          <button
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((s) => (s - 1) as Step)}
            className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
          >
            ← Back
          </button>
          {currentStep < 4 && (
            <button
              disabled={!stepValid[currentStep]}
              onClick={() => setCurrentStep((s) => (s + 1) as Step)}
              className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              Next →
            </button>
          )}
        </footer>
      </main>
    </div>
  )
}

