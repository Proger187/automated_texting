import fs from 'fs'
import path from 'path'
import { Client, LocalAuth } from 'whatsapp-web.js'
import type { IMessagingAdapter, SendResult } from './types'

// Cached authenticated client — persists for the lifetime of the main process
let cachedClient: Client | null = null
let isAuthenticated = false
let initPromise: Promise<void> | null = null
let disconnectCallback: (() => void) | null = null

/** Delete the LocalAuth session folder so the next init always shows a fresh QR. */
function clearAuthDir(): void {
  const dir = path.join(process.cwd(), '.wwebjs_auth')
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
  } catch { /* ignore — best-effort cleanup */ }
}

function getClient(): Client {
  if (!cachedClient) {
    cachedClient = new Client({
      // LocalAuth persists the Chromium session to disk so the user only
      // needs to scan the QR code once per machine.
      authStrategy: new LocalAuth(),
      puppeteer: { headless: true, args: ['--no-sandbox'] },
    })

    cachedClient.on('authenticated', () => {
      isAuthenticated = true
    })

    cachedClient.on('auth_failure', () => {
      isAuthenticated = false
      cachedClient = null
      initPromise = null
      clearAuthDir()
      disconnectCallback?.()
    })

    cachedClient.on('disconnected', () => {
      isAuthenticated = false
      cachedClient = null
      initPromise = null
      clearAuthDir()  // stale session on disk would prevent QR on next init
      disconnectCallback?.()
    })
  }
  return cachedClient
}

export function initWhatsApp(
  onQr: (qr: string) => void,
  onReady?: () => void,
  onDisconnected?: () => void,
): Promise<void> {
  if (initPromise) return initPromise

  disconnectCallback = onDisconnected ?? null
  const client = getClient()

  cachedClient!.removeAllListeners('qr')
  cachedClient!.on('qr', (qr: string) => { onQr(qr) })

  cachedClient!.removeAllListeners('ready')
  cachedClient!.on('ready', () => {
    isAuthenticated = true
    onReady?.()
  })

  initPromise = client.initialize()
  return initPromise
}

/**
 * Destroys the current client and clears all cached state so a fresh QR is generated.
 */
export async function destroyWhatsApp(): Promise<void> {
  disconnectCallback = null   // suppress the spontaneous-disconnect handler during explicit destroy
  initPromise = null
  isAuthenticated = false
  if (cachedClient) {
    try { await cachedClient.destroy() } catch { /* ignore */ }
    cachedClient = null
  }
  clearAuthDir()  // force fresh QR on next init
}

export class WhatsAppAdapter implements IMessagingAdapter {
  async send(
    contact: string,
    message: string,
    _credentials: unknown,
  ): Promise<SendResult> {
    if (!isAuthenticated || !cachedClient) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      // WhatsApp chat IDs are phone numbers with @c.us suffix
      const chatId = contact.includes('@') ? contact : `${contact}@c.us`
      await cachedClient.sendMessage(chatId, message)
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  }
}

export const whatsappAdapter = new WhatsAppAdapter()
