import type { CredentialType } from './ipc'

export type { CredentialType }

// ── Per-adapter credential shapes ─────────────────────────────────────────────

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
  smtpPresetId?: string
}

export interface InstagramCredentials {
  username: string
  password: string
  /** JSON-serialized ig.state.serialize() — persisted after first login */
  sessionData?: string
}

export interface TelegramUserCredentials {
  /** API ID from my.telegram.org */
  apiId: number
  /** API Hash from my.telegram.org */
  apiHash: string
  /** Phone in E.164 format, e.g. +996700123456 */
  phone: string
  /** GramJS StringSession — persisted after first login */
  sessionString?: string
}

export type AccountCredentials =
  | WhatsAppCredentials
  | TelegramCredentials
  | EmailCredentials
  | InstagramCredentials
  | TelegramUserCredentials

// ── Account record ─────────────────────────────────────────────────────────────

export interface Account {
  /** UUID v4 generated at creation time */
  id: string
  /** User-chosen display label, e.g. "Main WhatsApp", "Support Gmail" */
  name: string
  /** Adapter type this account belongs to */
  type: CredentialType
  credentials: AccountCredentials
  /** ISO 8601 timestamp */
  createdAt: string
}
