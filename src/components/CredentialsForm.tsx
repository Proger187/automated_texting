import { useState, useEffect } from 'react'
import type { CredentialType } from '../types/ipc'
import { useAppStore } from '../store/appStore'
import type {
  WhatsAppCredentials,
  TelegramCredentials,
  EmailCredentials,
} from '../services/credentialsStore'

// ── Local form state types ─────────────────────────────────────────────────────

interface TelegramForm {
  token: string
  defaultChatId: string
}

interface EmailForm {
  host: string
  port: string
  user: string
  pass: string
  from: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const TABS: CredentialType[] = ['whatsapp', 'telegram', 'email']

const TAB_LABEL: Record<CredentialType, string> = {
  whatsapp:     'WhatsApp',
  telegram:     'Telegram',
  telegramUser: 'Telegram User',
  email:        'Email / SMTP',
  instagram:    'Instagram',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CredentialsForm(): JSX.Element {
  const [activeTab, setActiveTab] = useState<CredentialType>('telegram')

  // per-tab form state
  const [telegramForm, setTelegramForm] = useState<TelegramForm>({
    token: '',
    defaultChatId: '',
  })
  const [emailForm, setEmailForm] = useState<EmailForm>({
    host: '',
    port: '587',
    user: '',
    pass: '',
    from: '',
  })
  const [whatsappSession, setWhatsappSession] = useState<string | undefined>(undefined)

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [whatsappStatus, setWhatsappStatus] = useState<'disconnected' | 'connected'>('disconnected')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  // ── Subscribe to WhatsApp QR whenever on the whatsapp tab ────────────────────

  useEffect(() => {
    if (activeTab !== 'whatsapp' || !window.electronAPI) return

    // Get any QR that was already emitted before this tab was opened
    void window.electronAPI.getWhatsappQr().then((cached) => {
      if (cached) setQrDataUrl(cached)
    })

    // Subscribe to future QR refreshes (whatsapp-web.js re-emits every ~30 s)
    const unsubscribe = window.electronAPI.onWhatsappQr((dataUrl) => {
      setQrDataUrl(dataUrl)
    })

    return unsubscribe
  }, [activeTab])

  // ── Load existing credentials on tab change ──────────────────────────────────

  useEffect(() => {
    let cancelled = false

    async function loadForTab(type: CredentialType): Promise<void> {
      if (!window.electronAPI) return
      try {
        const data = await window.electronAPI.loadCredentials(type)
        if (cancelled || !data) return

        if (type === 'telegram') {
          const t = data as TelegramCredentials
          setTelegramForm({
            token: t.token ?? '',
            defaultChatId: t.defaultChatId ?? '',
          })
        } else if (type === 'email') {
          const e = data as EmailCredentials
          setEmailForm({
            host: e.host ?? '',
            port: String(e.port ?? 587),
            user: e.user ?? '',
            pass: e.pass ?? '',
            from: e.from ?? '',
          })
        } else if (type === 'whatsapp') {
          const w = data as WhatsAppCredentials
          setWhatsappSession(w.sessionData)
          if (w.sessionData) setWhatsappStatus('connected')
        }
      } catch {
        // Silently ignore load failures; form stays empty
      }
    }

    void loadForTab(activeTab)
    setSaveStatus('idle')

    return () => {
      cancelled = true
    }
  }, [activeTab])

  // ── Save handler ─────────────────────────────────────────────────────────────

  const handleSave = async (): Promise<void> => {
    if (!window.electronAPI) {
      setSaveStatus('error')
      return
    }
    setSaveStatus('saving')
    try {
      if (activeTab === 'telegram') {
        const payload: TelegramCredentials = {
          token: telegramForm.token.trim(),
          ...(telegramForm.defaultChatId.trim()
            ? { defaultChatId: telegramForm.defaultChatId.trim() }
            : {}),
        }
        await window.electronAPI.saveCredentials('telegram', payload)
      } else if (activeTab === 'email') {
        const payload: EmailCredentials = {
          host: emailForm.host.trim(),
          port: parseInt(emailForm.port, 10) || 587,
          user: emailForm.user.trim(),
          pass: emailForm.pass,
          from: emailForm.from.trim(),
        }
        await window.electronAPI.saveCredentials('email', payload)
      } else if (activeTab === 'whatsapp') {
        const payload: WhatsAppCredentials = {
          ...(whatsappSession ? { sessionData: whatsappSession } : {}),
        }
        await window.electronAPI.saveCredentials('whatsapp', payload)
      }
      setSaveStatus('saved')
      useAppStore.getState().markCredentialsSaved(activeTab)
    } catch {
      setSaveStatus('error')
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const inputClass =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent'

  const labelClass = 'block text-sm font-semibold text-gray-700 mb-1'

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto">

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
              activeTab === tab
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ].join(' ')}
          >
            {TAB_LABEL[tab]}
          </button>
        ))}
      </div>

      {/* ── WhatsApp tab ── */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-6">
          {/* QR code */}
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-10 bg-gray-50">
            {qrDataUrl ? (
              <>
                <img
                  src={qrDataUrl}
                  alt="WhatsApp QR code"
                  className="w-52 h-52 rounded-lg"
                />
                <p className="text-xs text-gray-400 text-center mt-3">
                  Scan with WhatsApp on your phone to authenticate.
                  <br />
                  The QR refreshes automatically if it expires.
                </p>
              </>
            ) : (
              <>
                <div className="w-52 h-52 bg-gray-200 rounded-lg flex items-center justify-center">
                  <svg className="animate-spin w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                </div>
                <p className="text-xs text-gray-400 text-center mt-3">
                  Waiting for QR code from WhatsApp…
                  <br />
                  Make sure the app has started successfully.
                </p>
              </>
            )}
          </div>

          {/* Session status badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">Status:</span>
            <span
              className={[
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold',
                whatsappStatus === 'connected'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block w-2 h-2 rounded-full',
                  whatsappStatus === 'connected' ? 'bg-green-500' : 'bg-gray-400',
                ].join(' ')}
              />
              {whatsappStatus === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      )}

      {/* ── Telegram tab ── */}
      {activeTab === 'telegram' && (
        <div className="space-y-4">
          <div>
            <label htmlFor="tg-token" className={labelClass}>
              Bot Token <span className="text-red-500">*</span>
            </label>
            <input
              id="tg-token"
              type="password"
              placeholder="123456789:AAFxxxxxxxx"
              value={telegramForm.token}
              onChange={(e) =>
                setTelegramForm((prev) => ({ ...prev, token: e.target.value }))
              }
              className={inputClass}
              autoComplete="off"
            />
            <p className="text-xs text-gray-400 mt-1">
              Obtain from{' '}
              <span className="font-mono">@BotFather</span> on Telegram.
            </p>
          </div>

          <div>
            <label htmlFor="tg-chat-id" className={labelClass}>
              Default Chat ID
              <span className="text-gray-400 font-normal ml-1 text-xs">(optional)</span>
            </label>
            <input
              id="tg-chat-id"
              type="text"
              placeholder="-100123456789"
              value={telegramForm.defaultChatId}
              onChange={(e) =>
                setTelegramForm((prev) => ({ ...prev, defaultChatId: e.target.value }))
              }
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* ── Email / SMTP tab ── */}
      {activeTab === 'email' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label htmlFor="smtp-host" className={labelClass}>
                SMTP Host <span className="text-red-500">*</span>
              </label>
              <input
                id="smtp-host"
                type="text"
                placeholder="smtp.gmail.com"
                value={emailForm.host}
                onChange={(e) =>
                  setEmailForm((prev) => ({ ...prev, host: e.target.value }))
                }
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="smtp-port" className={labelClass}>
                Port
              </label>
              <input
                id="smtp-port"
                type="number"
                min={1}
                max={65535}
                placeholder="587"
                value={emailForm.port}
                onChange={(e) =>
                  setEmailForm((prev) => ({ ...prev, port: e.target.value }))
                }
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="smtp-user" className={labelClass}>
              Username <span className="text-red-500">*</span>
            </label>
            <input
              id="smtp-user"
              type="text"
              placeholder="you@example.com"
              value={emailForm.user}
              onChange={(e) =>
                setEmailForm((prev) => ({ ...prev, user: e.target.value }))
              }
              className={inputClass}
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="smtp-pass" className={labelClass}>
              Password <span className="text-red-500">*</span>
            </label>
            <input
              id="smtp-pass"
              type="password"
              placeholder="••••••••"
              value={emailForm.pass}
              onChange={(e) =>
                setEmailForm((prev) => ({ ...prev, pass: e.target.value }))
              }
              className={inputClass}
              autoComplete="current-password"
            />
          </div>

          <div>
            <label htmlFor="smtp-from" className={labelClass}>
              From Address <span className="text-red-500">*</span>
            </label>
            <input
              id="smtp-from"
              type="email"
              placeholder="Sender Name <sender@example.com>"
              value={emailForm.from}
              onChange={(e) =>
                setEmailForm((prev) => ({ ...prev, from: e.target.value }))
              }
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* Save button + status */}
      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={() => void handleSave()}
          disabled={saveStatus === 'saving'}
          className="px-6 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {saveStatus === 'saving' ? 'Saving…' : 'Save credentials'}
        </button>

        {saveStatus === 'saved' && (
          <span className="text-green-600 text-sm font-medium flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 bg-green-100 rounded-full text-xs font-bold text-green-600">
              ✓
            </span>
            Saved
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="text-red-600 text-sm font-medium">
            ⚠️ Failed to save. Please try again.
          </span>
        )}
      </div>
    </div>
  )
}
