import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { saveCredentials, loadCredentials } from './src/services/credentialsStore'
import type { CredentialType } from './src/types/ipc'
import type { Credentials } from './src/services/credentialsStore'
import { initWhatsApp } from './src/adapters/whatsappAdapter'
import type { SendMessagesArgs } from './src/types/ipc'
import { startQueue, pauseQueue, resumeQueue, cancelQueue } from './src/services/sendQueue'
import { saveDelayOverride, loadDelayOverride, saveDefaultCountryCode, loadDefaultCountryCode, saveConcurrency, loadConcurrency, saveInterMessageDelay, loadInterMessageDelay } from './src/services/rateLimiter'
import QRCode from 'qrcode'
import type { AppSettings } from './src/types/ipc'
import { listAccounts, listAccountsByType, saveAccount, deleteAccount, getAccount } from './src/services/accountsStore'
import type { Account } from './src/types/accounts'
import { listSmtpPresets, saveSmtpPreset, deleteSmtpPreset } from './src/services/smtpPresetsStore'
import type { SmtpPreset } from './src/types/smtpPresets'
import { IgApiClient, IgCheckpointError } from 'instagram-private-api'
import { initInstagram, tryRestoreInstagramSession, setIgClient } from './src/adapters/instagramAdapter'
import type { InstagramCredentials, TelegramUserCredentials } from './src/types/accounts'
import { initTelegramUser } from './src/adapters/telegramUserAdapter'

let mainWindow: BrowserWindow | null = null
let lastQrDataUrl: string | null = null
let isWhatsAppReady = false

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' as const } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (process.env['VITE_DEV_SERVER_URL']) {
    mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// IPC Handlers — placeholders, implemented in later modules

ipcMain.handle('send-messages', async (event, args: SendMessagesArgs) => {
  // Eagerly initialise Instagram session before the queue starts
  if (args.adapterType === 'instagram') {
    const creds = args.credentials as InstagramCredentials
    try {
      // Try restoring a persisted session first; only do a full login if needed
      const restored = await tryRestoreInstagramSession(creds)
      let sessionData: string | undefined
      if (!restored) {
        sessionData = await initInstagram(creds.username, creds.password)
      }
      // Persist the newly acquired session data back to the account store
      if (sessionData) {
        const allAccounts = listAccounts()
        const match = allAccounts.find(
          (a) => a.type === 'instagram' &&
                 (a.credentials as InstagramCredentials).username === creds.username
        )
        if (match) {
          saveAccount({
            ...match,
            credentials: { ...creds, sessionData },
          })
        }
      }
      if (!event.sender.isDestroyed()) event.sender.send('instagram-status', 'connected')
    } catch {
      if (!event.sender.isDestroyed()) event.sender.send('instagram-status', 'error')
    }
  }
  await startQueue({
    ...args,
    onProgress: (payload) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('send-progress', payload)
      }
    },
    onComplete: (_result) => {
      // QueueResult is consumed by the renderer via ProgressPayload.done
      // Full logging handled in Module 7
    },
  })
})

ipcMain.on('cancel-send', () => {
  cancelQueue()
})

ipcMain.on('pause-send', () => {
  pauseQueue()
})

ipcMain.on('resume-send', () => {
  resumeQueue()
})

ipcMain.handle('load-credentials', async (_event, type: CredentialType) => {
  return loadCredentials(type)
})

ipcMain.handle('save-credentials', async (_event, type: CredentialType, data: Credentials) => {
  saveCredentials(type, data)
})

ipcMain.handle('save-settings', async (_event, settings: AppSettings) => {
  saveDelayOverride(settings.delayMs)
  saveDefaultCountryCode(settings.defaultCountryCode ?? '')
  saveConcurrency(settings.concurrency ?? 1)
  saveInterMessageDelay(settings.interMessageDelayMs ?? 1500)
})

ipcMain.handle('load-settings', async (): Promise<AppSettings> => {
  return {
    delayMs: loadDelayOverride(),
    defaultCountryCode: loadDefaultCountryCode(),
    concurrency: loadConcurrency(),
    interMessageDelayMs: loadInterMessageDelay(),
  }
})

ipcMain.handle('get-whatsapp-qr', () => lastQrDataUrl)
ipcMain.handle('get-whatsapp-ready', () => isWhatsAppReady)

ipcMain.handle('list-accounts', (_e, type?: CredentialType) =>
  type ? listAccountsByType(type) : listAccounts())

ipcMain.handle('save-account', (_e, account: Account) => saveAccount(account))

ipcMain.handle('delete-account', (_e, id: string) => deleteAccount(id))

ipcMain.handle('get-account', (_e, id: string) => getAccount(id))

ipcMain.handle('list-smtp-presets', () => listSmtpPresets())
ipcMain.handle('save-smtp-preset', (_e, preset: SmtpPreset) => saveSmtpPreset(preset))
ipcMain.handle('delete-smtp-preset', (_e, id: string) => deleteSmtpPreset(id))

// ── Telegram User (MTProto) login flow ───────────────────────────────────

interface PendingTgLogin {
  resolveCode: (code: string) => void
  resolvePassword: (pass: string) => void
  /** Resolves with the session string (login done) or '2FA_REQUIRED' */
  phase2: Promise<string>
  /** Resolves with the final session string after all auth steps */
  loginDone: Promise<string>
}

const pendingTgLogins = new Map<string, PendingTgLogin>()

ipcMain.handle('request-telegram-user-code', async (_e, accountId: string): Promise<void> => {
  const account = getAccount(accountId)
  if (!account) throw new Error(`Account not found: ${accountId}`)
  const creds = account.credentials as TelegramUserCredentials

  let resolveCode!: (code: string) => void
  let resolvePassword!: (pass: string) => void
  let resolvePhase2!: (val: string) => void
  let rejectPhase2!: (err: unknown) => void
  let resolveCodeRequested!: () => void
  let rejectCodeRequested!: (e: unknown) => void

  const codePromise = new Promise<string>(r => { resolveCode = r })
  const passPromise = new Promise<string>(r => { resolvePassword = r })
  const phase2 = new Promise<string>((res, rej) => { resolvePhase2 = res; rejectPhase2 = rej })
  // Resolves as soon as Telegram calls our phoneCode callback (code was sent to user's phone)
  const codeRequested = new Promise<void>((res, rej) => {
    resolveCodeRequested = res
    rejectCodeRequested = rej
  })

  const loginDone = initTelegramUser(
    creds,
    async () => {
      // Telegram is asking for the code — signal to the handler that the SMS/app code was sent
      resolveCodeRequested()
      return codePromise
    },
    async (_hint?: string) => { resolvePhase2('2FA_REQUIRED'); return passPromise },
  )

  loginDone
    .then((session) => resolvePhase2(session))
    .catch((err: unknown) => {
      rejectPhase2(err)
      // Also reject codeRequested so the handler doesn't hang on login failures
      rejectCodeRequested(err)
    })

  pendingTgLogins.set(accountId, { resolveCode, resolvePassword, phase2, loginDone })

  // Wait until Telegram has actually dispatched the code (or the login flow failed).
  // This ensures the renderer only shows the code input after the SMS/app notification was sent,
  // and gets a proper error if apiId/apiHash/phone are wrong.
  await codeRequested
})

ipcMain.handle('complete-telegram-user-login', async (_e, accountId: string, code: string): Promise<string> => {
  const pending = pendingTgLogins.get(accountId)
  if (!pending) throw new Error('No pending Telegram login for account ' + accountId)
  pending.resolveCode(code)
  const result = await pending.phase2
  if (result === '2FA_REQUIRED') throw new Error('2FA_REQUIRED')
  // Login succeeded without 2FA
  pending.resolvePassword('')  // clean up passPromise
  pendingTgLogins.delete(accountId)
  const account = getAccount(accountId)
  if (account) {
    const creds = account.credentials as TelegramUserCredentials
    saveAccount({ ...account, credentials: { ...creds, sessionString: result } })
  }
  return result
})

ipcMain.handle('complete-telegram-user-2fa', async (_e, accountId: string, password: string): Promise<string> => {
  const pending = pendingTgLogins.get(accountId)
  if (!pending) throw new Error('No pending Telegram login for account ' + accountId)
  pending.resolvePassword(password)
  const sessionStr = await pending.loginDone
  pendingTgLogins.delete(accountId)
  const account = getAccount(accountId)
  if (account) {
    const creds = account.credentials as TelegramUserCredentials
    saveAccount({ ...account, credentials: { ...creds, sessionString: sessionStr } })
  }
  return sessionStr
})

// ── Instagram account connect flow ───────────────────────────────────────────

interface PendingIgConnect {
  ig: IgApiClient
  username: string
}
const pendingIgConnects = new Map<string, PendingIgConnect>()

ipcMain.handle('request-instagram-connect', async (_e, accountId: string): Promise<{ status: 'connected' | 'challenge_required', sessionData?: string, contactPoint?: string }> => {
  const account = getAccount(accountId)
  if (!account) throw new Error(`Account not found: ${accountId}`)
  const creds = account.credentials as InstagramCredentials

  if (!creds.username?.trim() || !creds.password?.trim()) {
    throw new Error('Username and password are required.')
  }

  const ig = new IgApiClient()
  ig.state.generateDevice(creds.username)
  try {
    await ig.account.login(creds.username, creds.password)
    // Verify the session is genuinely authenticated
    await ig.account.currentUser()
    const serialized = await ig.state.serialize()
    delete (serialized as Record<string, unknown>).constants
    const sessionData = JSON.stringify(serialized)
    saveAccount({ ...account, credentials: { ...creds, sessionData } })
    setIgClient(ig, creds.username)
    return { status: 'connected', sessionData }
  } catch (e) {
    if (e instanceof IgCheckpointError) {
      // Reset the challenge and request a verification code
      const challengeState = await ig.challenge.auto(true)
      // Extract where the code was sent (masked email/phone shown by Instagram)
      const csAny = challengeState as unknown as Record<string, unknown>
      const contactPoint: string | undefined = csAny?.step_data
        ? String((csAny.step_data as Record<string, unknown>)?.contact_point ?? '') || undefined
        : undefined
      pendingIgConnects.set(accountId, { ig, username: creds.username })
      return { status: 'challenge_required', contactPoint: contactPoint || undefined }
    }
    throw e
  }
})

ipcMain.handle('complete-instagram-challenge', async (_e, accountId: string, code: string): Promise<string> => {
  const pending = pendingIgConnects.get(accountId)
  if (!pending) throw new Error('No pending Instagram challenge for account ' + accountId)
  const { ig, username } = pending
  await ig.challenge.sendSecurityCode(code)
  // Verify the session is valid after challenge — this also catches the case where
  // the original credentials were wrong (checkpoint fired before password check)
  try {
    await ig.account.currentUser()
  } catch {
    pendingIgConnects.delete(accountId)
    throw new Error('Verification succeeded but login failed. Check your username and password.')
  }
  const serialized = await ig.state.serialize()
  delete (serialized as Record<string, unknown>).constants
  const sessionData = JSON.stringify(serialized)
  pendingIgConnects.delete(accountId)
  const account = getAccount(accountId)
  if (account) {
    const creds = account.credentials as InstagramCredentials
    saveAccount({ ...account, credentials: { ...creds, sessionData } })
  }
  setIgClient(ig, username)
  return sessionData
})

// Initialise WhatsApp client on startup so QR appears immediately
app.on('ready', () => {
  createWindow()
  initWhatsApp(
    (qr) => {
      QRCode.toDataURL(qr, { width: 256, margin: 2 })
        .then((dataUrl) => {
          lastQrDataUrl = dataUrl
          mainWindow?.webContents.send('whatsapp-qr', dataUrl)
        })
        .catch(() => { /* qr conversion failure is non-fatal */ })
    },
    () => {
      isWhatsAppReady = true
      mainWindow?.webContents.send('whatsapp-ready')
    },
  ).catch(() => {
    // WhatsApp init failures are non-fatal
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
