import { Client, LocalAuth } from 'whatsapp-web.js'
import type { IMessagingAdapter, SendResult } from './types'

// Cached authenticated client — persists for the lifetime of the main process
let cachedClient: Client | null = null
let isAuthenticated = false
let initPromise: Promise<void> | null = null

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
    })

    cachedClient.on('disconnected', () => {
      isAuthenticated = false
      cachedClient = null
      initPromise = null
    })
  }
  return cachedClient
}

export function initWhatsApp(
  onQr: (qr: string) => void,
  onReady?: () => void,
): Promise<void> {
  if (initPromise) return initPromise

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
  initPromise = null
  isAuthenticated = false
  if (cachedClient) {
    try { await cachedClient.destroy() } catch { /* ignore */ }
    cachedClient = null
  }
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
