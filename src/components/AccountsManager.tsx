import { useState, useEffect, useCallback } from 'react'
import type { Account, AccountCredentials, TelegramCredentials, TelegramUserCredentials, EmailCredentials, InstagramCredentials } from '../types/accounts'
import type { CredentialType } from '../types/ipc'
import type { SmtpPreset } from '../types/smtpPresets'
import { useAppStore } from '../store/appStore'
import SmtpPresetsManager from './SmtpPresetsManager'

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | CredentialType

const TYPE_LABELS: Record<CredentialType, string> = {
  whatsapp:     'WhatsApp',
  telegram:     'Telegram Bot',
  telegramUser: 'Telegram User',
  email:        'Email',
  instagram:    'Instagram',
}

const TYPE_COLORS: Record<CredentialType, string> = {
  whatsapp:     'bg-green-100 text-green-700',
  telegram:     'bg-sky-100 text-sky-700',
  telegramUser: 'bg-blue-100 text-blue-700',
  email:        'bg-orange-100 text-orange-700',
  instagram:    'bg-pink-100 text-pink-700',
}

const TYPE_ICONS: Record<CredentialType, string> = {
  whatsapp:     '💬',
  telegram:     '✈️',
  telegramUser: '👤',
  email:        '📧',
  instagram:    '📸',
}

// Empty credential defaults per type
function defaultCredentials(type: CredentialType): AccountCredentials {
  switch (type) {
    case 'whatsapp':     return {}
    case 'telegram':     return { token: '', defaultChatId: '' }
    case 'telegramUser': return { apiId: 0, apiHash: '', phone: '', sessionString: undefined }
    case 'email':        return { host: '', port: 587, user: '', pass: '', from: '', smtpPresetId: undefined }
    case 'instagram':    return { username: '', password: '' }
  }
}

// ── Sub-form: Telegram ────────────────────────────────────────────────────────

interface TelegramFormProps {
  creds: TelegramCredentials
  onChange: (c: TelegramCredentials) => void
}
function TelegramForm({ creds, onChange }: TelegramFormProps): JSX.Element {
  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Bot Token <span className="text-red-500">*</span></label>
        <input type="text" className={inp} placeholder="123456:ABC-DEF..."
          value={creds.token}
          onChange={(e) => onChange({ ...creds, token: e.target.value })} />
        <p className="text-xs text-gray-400 mt-1">Get this from @BotFather on Telegram.</p>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Default Chat ID <span className="text-gray-400">(optional)</span></label>
        <input type="text" className={inp} placeholder="e.g. 123456789 or @channelname"
          value={creds.defaultChatId ?? ''}
          onChange={(e) => onChange({ ...creds, defaultChatId: e.target.value })} />
      </div>
    </div>
  )
}

// ── Sub-form: Email ───────────────────────────────────────────────────────────

interface EmailFormProps {
  creds: EmailCredentials
  onChange: (c: EmailCredentials) => void
}
function EmailForm({ creds, onChange }: EmailFormProps): JSX.Element {
  const [presets, setPresets] = useState<SmtpPreset[]>([])
  const [showPresetsManager, setShowPresetsManager] = useState(false)

  // Selected preset id: 'custom' or a preset's id
  const selectedPresetId = creds.smtpPresetId ?? 'custom'
  const usingPreset = selectedPresetId !== 'custom'

  const loadPresets = useCallback(async () => {
    if (!window.electronAPI) return
    const list = await window.electronAPI.listSmtpPresets()
    setPresets(list)
  }, [])

  useEffect(() => {
    void loadPresets()
  }, [loadPresets])

  function handlePresetChange(id: string): void {
    if (id === 'custom') {
      onChange({ ...creds, smtpPresetId: undefined })
      return
    }
    const preset = presets.find((p) => p.id === id)
    if (!preset) return
    onChange({
      ...creds,
      smtpPresetId: preset.id,
      host: preset.host,
      port: preset.port,
    })
  }

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'
  const inpReadonly = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed'

  return (
    <div className="space-y-4">
      {/* Preset selector */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-semibold text-gray-700">SMTP server</label>
          <button
            type="button"
            onClick={() => {
              setShowPresetsManager((v) => !v)
              if (!showPresetsManager) void loadPresets()
            }}
            className="text-xs text-violet-600 hover:underline"
          >
            Manage servers…
          </button>
        </div>
        <select
          className={inp}
          value={selectedPresetId}
          onChange={(e) => handlePresetChange(e.target.value)}
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.host}:{p.port})</option>
          ))}
          <option value="custom">Custom…</option>
        </select>
      </div>

      {/* Inline presets manager */}
      {showPresetsManager && (
        <SmtpPresetsManager
          onClose={() => {
            setShowPresetsManager(false)
            void loadPresets()
          }}
        />
      )}

      {/* Host + Port — readonly when preset is active */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">SMTP Host <span className="text-red-500">*</span></label>
          <input
            type="text"
            className={usingPreset ? inpReadonly : inp}
            placeholder="smtp.gmail.com"
            readOnly={usingPreset}
            value={creds.host}
            onChange={(e) => !usingPreset && onChange({ ...creds, host: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Port</label>
          <input
            type="number"
            className={usingPreset ? inpReadonly : inp}
            placeholder="587"
            readOnly={usingPreset}
            value={creds.port}
            onChange={(e) => !usingPreset && onChange({ ...creds, port: parseInt(e.target.value, 10) || 587 })}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Username (email address) <span className="text-red-500">*</span></label>
        <input type="email" className={inp} placeholder="you@example.com"
          value={creds.user}
          onChange={(e) => onChange({ ...creds, user: e.target.value })} />
        <p className="text-xs text-gray-400 mt-1">Your full email address — used to log in to the SMTP server.</p>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
        <input type="password" className={inp} placeholder="••••••••"
          value={creds.pass}
          onChange={(e) => onChange({ ...creds, pass: e.target.value })} />
        <p className="text-xs text-gray-400 mt-1">For Gmail use an App Password (not your regular password).</p>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">From Address <span className="text-red-500">*</span></label>
        <input type="email" className={inp} placeholder="Sender Name &lt;you@example.com&gt;"
          value={creds.from}
          onChange={(e) => onChange({ ...creds, from: e.target.value })} />
      </div>
    </div>
  )
}

// ── Sub-form: Instagram ───────────────────────────────────────────────────────

interface InstagramFormProps {
  creds: InstagramCredentials
  accountId: string | null
  onChange: (c: InstagramCredentials) => void
}

type IgConnectPhase = 'idle' | 'connecting' | 'challenge' | 'connected' | 'error'

function InstagramForm({ creds, accountId, onChange }: InstagramFormProps): JSX.Element {
  const [phase, setPhase] = useState<IgConnectPhase>('idle')
  const [codeDraft, setCodeDraft] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [contactPoint, setContactPoint] = useState('')

  async function handleConnect(): Promise<void> {
    if (!accountId) { setErrorMsg('Save the account first, then connect.'); return }
    if (!creds.username?.trim() || !creds.password?.trim()) {
      setErrorMsg('Fill in username and password first, then save the account.')
      return
    }
    setPhase('connecting')
    setErrorMsg('')
    setContactPoint('')
    try {
      const result = await window.electronAPI.requestInstagramConnect(accountId)
      if (result.status === 'connected') {
        if (result.sessionData) onChange({ ...creds, sessionData: result.sessionData })
        setPhase('connected')
      } else {
        if (result.contactPoint) setContactPoint(result.contactPoint)
        setCodeDraft('')
        setPhase('challenge')
      }
    } catch (e) {
      setErrorMsg(String(e).replace(/^Error: /, ''))
      setPhase('error')
    }
  }

  async function handleSubmitCode(): Promise<void> {
    if (!accountId) return
    try {
      const sessionData = await window.electronAPI.completeInstagramChallenge(accountId, codeDraft.trim())
      onChange({ ...creds, sessionData })
      setPhase('connected')
    } catch (e) {
      setErrorMsg(String(e))
      setPhase('error')
    }
  }

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'
  const isConnected = phase === 'connected' || (phase === 'idle' && !!creds.sessionData)

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span className={[
          'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full',
          isConnected ? 'bg-green-100 text-green-700' :
          phase === 'error' ? 'bg-red-100 text-red-600' :
          phase === 'challenge' ? 'bg-amber-100 text-amber-700' :
          phase === 'connecting' ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-500',
        ].join(' ')}>
          <span className={[
            'w-1.5 h-1.5 rounded-full',
            isConnected ? 'bg-green-500' :
            phase === 'error' ? 'bg-red-500' :
            phase === 'challenge' ? 'bg-amber-500' :
            phase === 'connecting' ? 'bg-blue-500' : 'bg-gray-400',
          ].join(' ')} />
          {isConnected ? 'Connected' :
           phase === 'connecting' ? 'Connecting…' :
           phase === 'challenge' ? 'Verification required' :
           phase === 'error' ? 'Login failed' : 'Not connected'}
        </span>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
        ⚠ Uses the unofficial Instagram API. Use a secondary account to avoid risk of action blocks.
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Instagram username <span className="text-red-500">*</span></label>
        <input type="text" className={inp} placeholder="yourusername"
          value={creds.username}
          onChange={(e) => onChange({ ...creds, username: e.target.value })} />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
        <input type="password" className={inp} placeholder="••••••••"
          value={creds.password}
          onChange={(e) => onChange({ ...creds, password: e.target.value })} />
      </div>

      {/* Challenge code input */}
      {phase === 'challenge' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <p className="text-sm text-blue-800 font-semibold">Instagram security verification</p>
          <p className="text-xs text-blue-600">
            {contactPoint
              ? <>Instagram sent a code to <strong>{contactPoint}</strong>. Enter it below.</>
              : 'Check your email or SMS linked to your Instagram account for a verification code.'}
          </p>
          <input
            type="text"
            className={inp}
            placeholder="6-digit code"
            value={codeDraft}
            onChange={(e) => setCodeDraft(e.target.value)}
          />
          <button
            onClick={() => void handleSubmitCode()}
            className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
          >
            Verify
          </button>
        </div>
      )}

      {errorMsg && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorMsg}</p>
      )}

      {phase !== 'challenge' && (
        <button
          onClick={() => void handleConnect()}
          disabled={phase === 'connecting' || !creds.username || !creds.password}
          className="w-full px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
        >
          {phase === 'connecting' ? 'Connecting…' : isConnected ? 'Reconnect' : 'Connect'}
        </button>
      )}
    </div>
  )
}
// ── Sub-form: Telegram User (MTProto) ────────────────────────────────────────

type TgUserPhase = 'idle' | 'connecting' | 'waiting-code' | 'waiting-2fa' | 'connected' | 'error'

interface TelegramUserFormProps {
  creds: TelegramUserCredentials
  accountId: string | null
  onChange: (c: TelegramUserCredentials) => void
}
function TelegramUserForm({ creds, accountId, onChange }: TelegramUserFormProps): JSX.Element {
  const [phase, setPhase] = useState<TgUserPhase>('idle')
  const [codeDraft, setCodeDraft] = useState('')
  const [passDraft, setPassDraft] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'

  async function handleConnect(): Promise<void> {
    if (!accountId) { setErrorMsg('Save the account first, then connect.'); return }
    setPhase('connecting')
    setErrorMsg('')
    try {
      await window.electronAPI.requestTelegramUserCode(accountId)
      setPhase('waiting-code')
    } catch (e) {
      setErrorMsg(String(e))
      setPhase('error')
    }
  }

  async function handleSubmitCode(): Promise<void> {
    if (!accountId) return
    try {
      const session = await window.electronAPI.completeTelegramUserLogin(accountId, codeDraft.trim())
      onChange({ ...creds, sessionString: session })
      setPhase('connected')
    } catch (e) {
      const msg = String(e)
      if (msg.includes('2FA_REQUIRED')) {
        setPhase('waiting-2fa')
      } else {
        setErrorMsg(msg)
        setPhase('error')
      }
    }
  }

  async function handleSubmitPassword(): Promise<void> {
    if (!accountId) return
    try {
      const session = await window.electronAPI.completeTelegramUser2FA(accountId, passDraft)
      onChange({ ...creds, sessionString: session })
      setPhase('connected')
    } catch (e) {
      setErrorMsg(String(e))
      setPhase('error')
    }
  }

  const statusLabel =
    phase === 'connected'    ? 'Connected' :
    phase === 'error'        ? 'Login failed' :
    phase === 'waiting-code' ? 'Enter verification code' :
    phase === 'waiting-2fa'  ? 'Enter 2FA password' :
    phase === 'connecting'   ? 'Connecting…' :
                               creds.sessionString ? 'Session saved' : 'Not connected'

  const statusDot =
    phase === 'connected' || creds.sessionString ? 'bg-green-500' :
    phase === 'error'                            ? 'bg-red-500'   :
    phase === 'idle'                             ? 'bg-gray-400'  :
                                                   'bg-amber-500'

  const statusBg =
    phase === 'connected' ? 'bg-green-100 text-green-700' :
    phase === 'error'     ? 'bg-red-100 text-red-600'     :
    phase === 'idle'      ? 'bg-gray-100 text-gray-500'   :
                            'bg-amber-100 text-amber-700'

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${statusBg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">API ID <span className="text-red-500">*</span></label>
          <input type="number" className={inp} placeholder="12345678"
            value={creds.apiId || ''}
            onChange={(e) => onChange({ ...creds, apiId: parseInt(e.target.value, 10) || 0 })} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">API Hash <span className="text-red-500">*</span></label>
          <input type="text" className={inp} placeholder="abcdef1234567890..."
            value={creds.apiHash}
            onChange={(e) => onChange({ ...creds, apiHash: e.target.value })} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Phone number <span className="text-red-500">*</span></label>
        <input type="tel" className={inp} placeholder="+996700123456"
          value={creds.phone}
          onChange={(e) => onChange({ ...creds, phone: e.target.value })} />
        <p className="text-xs text-gray-400 mt-1">International format. Get API credentials from my.telegram.org.</p>
      </div>

      {/* Connection flow */}
      {phase === 'idle' && (
        <button type="button"
          onClick={() => void handleConnect()}
          disabled={!accountId}
          className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
        >
          {!accountId ? 'Save account first, then connect' : 'Connect'}
        </button>
      )}

      {phase === 'connecting' && (
        <p className="text-sm text-gray-500 animate-pulse">Connecting to Telegram…</p>
      )}

      {phase === 'waiting-code' && (
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Verification code <span className="text-red-500">*</span></label>
          <div className="flex gap-2">
            <input type="text" className={inp} placeholder="12345"
              value={codeDraft} onChange={(e) => setCodeDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmitCode() }}
              autoFocus />
            <button type="button"
              onClick={() => void handleSubmitCode()}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold whitespace-nowrap"
            >Verify</button>
          </div>
          <p className="text-xs text-gray-400">Check your Telegram app for the code sent to {creds.phone}.</p>
        </div>
      )}

      {phase === 'waiting-2fa' && (
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Two-factor password <span className="text-red-500">*</span></label>
          <div className="flex gap-2">
            <input type="password" className={inp} placeholder="Your 2FA password"
              value={passDraft} onChange={(e) => setPassDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmitPassword() }}
              autoFocus />
            <button type="button"
              onClick={() => void handleSubmitPassword()}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold whitespace-nowrap"
            >Submit</button>
          </div>
        </div>
      )}

      {phase === 'connected' && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-green-600 font-semibold">✓ Login successful! Session saved.</p>
          <button type="button"
            onClick={() => { setPhase('idle'); setCodeDraft(''); setPassDraft('') }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >Reset</button>
        </div>
      )}

      {errorMsg && (
        <div className="space-y-1">
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorMsg}</p>
          <button type="button"
            onClick={() => { setPhase('idle'); setErrorMsg('') }}
            className="text-xs text-sky-600 underline"
          >Try again</button>
        </div>
      )}
    </div>
  )
}
// ── Sub-form: WhatsApp QR ─────────────────────────────────────────────────────

function WhatsAppQrPane(): JSX.Element {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    if (!window.electronAPI) return
    void window.electronAPI.getWhatsappReady().then((ready) => { if (ready) setIsReady(true) })
    void window.electronAPI.getWhatsappQr().then((cached) => { if (cached) setQrDataUrl(cached) })
    const unsubQr = window.electronAPI.onWhatsappQr((dataUrl) => { setQrDataUrl(dataUrl); setIsReady(false) })
    const unsubReady = window.electronAPI.onWhatsappReady(() => { setIsReady(true); setQrDataUrl(null) })
    return () => { unsubQr(); unsubReady() }
  }, [])

  async function handleDisconnect(): Promise<void> {
    setDisconnecting(true)
    setIsReady(false)
    setQrDataUrl(null)
    try { await window.electronAPI.disconnectWhatsapp() }
    finally { setDisconnecting(false) }
  }

  if (isReady) {
    return (
      <div className="flex flex-col items-center justify-center border-2 border-dashed border-green-300 rounded-xl p-8 bg-green-50 gap-4">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-green-700">WhatsApp Connected</p>
        <p className="text-xs text-green-500">Session active — no QR scan needed.</p>
        <button
          onClick={() => void handleDisconnect()}
          disabled={disconnecting}
          className="px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 text-sm font-semibold transition-colors"
        >
          {disconnecting ? 'Disconnecting…' : 'Disconnect & show new QR'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 bg-gray-50">
      {qrDataUrl ? (
        <>
          <img src={qrDataUrl} alt="WhatsApp QR code" className="w-48 h-48 rounded-lg" />
          <p className="text-xs text-gray-400 text-center mt-3">
            Scan with WhatsApp on your phone. QR refreshes automatically.
          </p>
        </>
      ) : (
        <>
          <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center">
            <svg className="animate-spin w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
          <p className="text-xs text-gray-400 text-center mt-3">
            Waiting for WhatsApp QR code…
          </p>
        </>
      )}
    </div>
  )
}

// ── Right pane: Account form ──────────────────────────────────────────────────

interface AccountFormProps {
  initial: Account | null   // null = create mode
  forceType?: CredentialType
  onSaved: () => void
  onCancel: () => void
}

function AccountForm({ initial, forceType, onSaved, onCancel }: AccountFormProps): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<CredentialType>(initial?.type ?? forceType ?? 'telegram')
  const [creds, setCreds] = useState<AccountCredentials>(
    initial?.credentials ?? defaultCredentials(initial?.type ?? forceType ?? 'telegram')
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // When type radio changes, reset credentials to defaults for new type
  function handleTypeChange(t: CredentialType): void {
    setType(t)
    setCreds(defaultCredentials(t))
  }

  function validate(): string | null {
    if (!name.trim()) return 'Display name is required.'
    if (type === 'telegram' && !(creds as TelegramCredentials).token?.trim())
      return 'Bot token is required.'
    if (type === 'telegramUser') {
      const t = creds as TelegramUserCredentials
      if (!t.apiId || t.apiId <= 0) return 'API ID is required.'
      if (!t.apiHash.trim())        return 'API Hash is required.'
      if (!t.phone.trim())          return 'Phone number is required.'
    }
    if (type === 'email') {
      const e = creds as EmailCredentials
      if (!e.host.trim()) return 'SMTP host is required.'
      if (!e.user.trim()) return 'Username is required.'
      if (!e.pass)        return 'Password is required.'
      if (!e.from.trim()) return 'From address is required.'
    }
    if (type === 'instagram') {
      const ig = creds as InstagramCredentials
      if (!ig.username.trim()) return 'Instagram username is required.'
      if (!ig.password)        return 'Password is required.'
    }
    return null
  }

  async function handleSave(): Promise<void> {
    const err = validate()
    if (err) { setError(err); return }
    if (!window.electronAPI) return
    setSaving(true)
    setError(null)
    try {
      const account: Account = initial
        ? { ...initial, name: name.trim(), type, credentials: creds }
        : {
            id: crypto.randomUUID(),
            name: name.trim(),
            type,
            credentials: creds,
            createdAt: new Date().toISOString(),
          }
      await window.electronAPI.saveAccount(account)
      onSaved()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(): Promise<void> {
    if (!initial || !window.electronAPI) return
    if (!confirm(`Delete account "${initial.name}"?`)) return
    await window.electronAPI.deleteAccount(initial.id)
    onSaved()
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h3 className="font-bold text-gray-900">{initial ? 'Edit account' : 'New account'}</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Display name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Display name <span className="text-red-500">*</span></label>
          <input type="text" className={inputClass} placeholder='e.g. "Main WhatsApp"'
            value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {/* Type selector */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Account type</p>
          <div className="grid grid-cols-2 gap-2">
            {(['whatsapp', 'telegram', 'telegramUser', 'email', 'instagram'] as CredentialType[]).map((t) => (
              <label
                key={t}
                className={[
                  'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors',
                  type === t
                    ? 'border-violet-500 bg-violet-50 text-violet-700 font-semibold'
                    : 'border-gray-200 text-gray-600 hover:border-violet-300',
                  // lock type if editing an existing account (can't change type)
                  initial ? 'opacity-60 cursor-not-allowed' : '',
                ].join(' ')}
              >
                <input type="radio" className="sr-only" name="actype" value={t}
                  checked={type === t}
                  onChange={() => !initial && handleTypeChange(t)}
                  disabled={!!initial}
                />
                <span>{TYPE_ICONS[t]}</span>
                {TYPE_LABELS[t]}
              </label>
            ))}
          </div>
        </div>

        {/* Credential fields by type */}
        {type === 'whatsapp' && <WhatsAppQrPane />}
        {type === 'telegram' && (
          <TelegramForm
            creds={creds as TelegramCredentials}
            onChange={setCreds}
          />
        )}
        {type === 'telegramUser' && (
          <TelegramUserForm
            creds={creds as TelegramUserCredentials}
            accountId={initial?.id ?? null}
            onChange={setCreds}
          />
        )}
        {type === 'email' && (
          <EmailForm
            creds={creds as EmailCredentials}
            onChange={setCreds}
          />
        )}
        {type === 'instagram' && (
          <InstagramForm
            creds={creds as InstagramCredentials}
            accountId={initial?.id ?? null}
            onChange={setCreds}
          />
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>

      <div className="px-6 py-4 border-t border-gray-200 flex gap-2">
        {initial && (
          <button
            onClick={() => void handleDelete()}
            className="px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold transition-colors"
          >
            Delete
          </button>
        )}
        <div className="flex-1" />
        <button onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-semibold transition-colors">
          Cancel
        </button>
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
        >
          {saving ? 'Saving…' : 'Save account'}
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  /** When set, the filter tab is locked to this type */
  lockedType?: CredentialType
}

export default function AccountsManager({ lockedType }: Props): JSX.Element {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [filterTab, setFilterTab] = useState<FilterTab>(lockedType ?? 'all')
  const [editingAccount, setEditingAccount] = useState<Account | null | 'new'>(null)

  const selectedAccountId = useAppStore((s) => s.selectedAccountId)
  const setSelectedAccountId = useAppStore((s) => s.setSelectedAccountId)

  // Lock the filter tab when lockedType changes
  useEffect(() => {
    if (lockedType) setFilterTab(lockedType)
  }, [lockedType])

  const loadAccounts = useCallback(async () => {
    if (!window.electronAPI) return
    const all = await window.electronAPI.listAccounts()
    setAccounts(all)
  }, [])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  function handleFormSaved(): void {
    setEditingAccount(null)
    void loadAccounts()
  }

  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',          label: 'All' },
    { key: 'whatsapp',     label: 'WhatsApp' },
    { key: 'telegram',     label: 'Telegram Bot' },
    { key: 'telegramUser', label: 'Tg User' },
    { key: 'email',        label: 'Email' },
    { key: 'instagram',    label: 'Instagram' },
  ]

  const filtered = filterTab === 'all'
    ? accounts
    : accounts.filter((a) => a.type === filterTab)

  const rightPaneOpen = editingAccount !== null

  return (
    <div className="flex h-full">
      {/* ── LEFT PANE ─────────────────────────────────────────────────────── */}
      <div className={[
        'flex flex-col border-r border-gray-200 bg-white transition-all',
        rightPaneOpen ? 'w-80 shrink-0' : 'flex-1',
      ].join(' ')}>

        {/* Filter tabs */}
        <div className="flex border-b border-gray-200 px-4 pt-4 gap-1 flex-wrap">
          {FILTER_TABS.map(({ key, label }) => {
            if (lockedType && key !== 'all' && key !== lockedType) return null
            return (
              <button
                key={key}
                onClick={() => setFilterTab(key)}
                className={[
                  'px-3 py-1.5 text-xs font-semibold rounded-t-lg border-b-2 -mb-px transition-colors',
                  filterTab === key
                    ? 'border-violet-600 text-violet-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Account list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-10">
              No accounts yet. Click "＋ New account" to add one.
            </p>
          )}
          {filtered.map((acc) => {
            const isSelected = acc.id === selectedAccountId
            return (
              <div
                key={acc.id}
                className={[
                  'rounded-xl border p-3 transition-colors',
                  isSelected
                    ? 'border-violet-400 bg-violet-50 ring-1 ring-violet-300'
                    : 'border-gray-200 bg-white hover:border-gray-300',
                ].join(' ')}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none mt-0.5">{TYPE_ICONS[acc.type]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900 truncate">{acc.name}</span>
                      {isSelected && <span className="text-green-500 text-xs font-bold">✓ Selected</span>}
                    </div>
                    <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[acc.type]}`}>
                      {TYPE_LABELS[acc.type]}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={[
                      'flex-1 text-xs font-semibold py-1.5 rounded-lg border transition-colors',
                      isSelected
                        ? 'bg-violet-600 border-violet-600 text-white'
                        : 'border-violet-300 text-violet-600 hover:bg-violet-50',
                    ].join(' ')}
                  >
                    {isSelected ? '✓ In use' : 'Select'}
                  </button>
                  <button
                    onClick={() => setEditingAccount(acc)}
                    className="px-3 text-xs font-semibold py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.electronAPI) return
                      if (!confirm(`Delete "${acc.name}"?`)) return
                      await window.electronAPI.deleteAccount(acc.id)
                      if (isSelected) setSelectedAccountId(null)
                      void loadAccounts()
                    }}
                    className="px-3 text-xs font-semibold py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* New account button */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => setEditingAccount('new')}
            className="w-full py-2.5 rounded-lg border-2 border-dashed border-violet-300 text-violet-600 text-sm font-semibold hover:bg-violet-50 transition-colors"
          >
            ＋ New account
          </button>
        </div>
      </div>

      {/* ── RIGHT PANE ────────────────────────────────────────────────────── */}
      {rightPaneOpen && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          <AccountForm
            initial={editingAccount === 'new' ? null : editingAccount}
            forceType={lockedType}
            onSaved={handleFormSaved}
            onCancel={() => setEditingAccount(null)}
          />
        </div>
      )}
    </div>
  )
}
