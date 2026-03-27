import Store from 'electron-store'
import type { CredentialType } from '../types/ipc'

// ── Credential interfaces ──────────────────────────────────────────────────────

export interface WhatsAppCredentials {
  sessionData?: string
}

export interface TelegramCredentials {
  token: string
  defaultChatId?: string
}

export interface EmailCredentials {
  host: string
  port: number
  user: string
  pass: string
  from: string
}

export type Credentials =
  | WhatsAppCredentials
  | TelegramCredentials
  | EmailCredentials

// ── Typed electron-store schema ────────────────────────────────────────────────

interface StoreSchema {
  credentials: {
    whatsapp: WhatsAppCredentials
    telegram: TelegramCredentials
    email: EmailCredentials
  }
}

const credStore = new Store<StoreSchema>({
  name: 'credentials',
  // electron-store ^8 uses encryptionKey for at-rest encryption
  encryptionKey: 'bulkmessenger-cred-key',
  defaults: {
    credentials: {
      whatsapp: {},
      telegram: { token: '' },
      email: { host: '', port: 587, user: '', pass: '', from: '' },
    },
  },
})

// ── Public API ─────────────────────────────────────────────────────────────────

export function saveCredentials(type: CredentialType, data: Credentials): void {
  credStore.set(`credentials.${type}`, data)
}

export function loadCredentials(type: CredentialType): Credentials | null {
  const value = credStore.get(`credentials.${type}` as keyof StoreSchema)
  if (!value) return null

  // Consider unset telegram credentials as null so the UI treats them as empty
  if (type === 'telegram') {
      const t = value as unknown as TelegramCredentials
      if (!t.token) return null
    }
    if (type === 'email') {
      const e = value as unknown as EmailCredentials
      if (!e.host && !e.user) return null
    }

  return value as Credentials
}
