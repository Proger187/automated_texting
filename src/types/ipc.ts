export type CredentialType = 'whatsapp' | 'telegram' | 'telegramUser' | 'email' | 'instagram'

export type { Account } from './accounts'
export type { SmtpPreset } from './smtpPresets'

export interface ProgressPayload {
  index: number
  total: number
  contact: string
  success: boolean
  error?: string
  done: boolean
}

export interface SendMessagesArgs {
  contacts: Record<string, string>[]
  contactField: string
  template: string
  adapterType: CredentialType
  credentials: unknown
  delayMs: number
  defaultCountryCode?: string
  concurrency?: number
  /** Subject line for email sends. */
  emailSubject?: string
  /** Ordered list of message templates to send to each contact. Falls back to template if absent. */
  messageSequence?: string[]
  /** Delay in ms between messages within a sequence for the same contact (default 1500). */
  interMessageDelayMs?: number
  /** Minimum random delay in ms between contacts (0 = disabled). */
  delayMin?: number
  /** Maximum random delay in ms between contacts (0 = disabled). When delayMin > 0 and delayMax > delayMin the actual delay is randomized. */
  delayMax?: number
}

export interface AppSettings {
  delayMs: number
  /** Default country code prepended when a phone number has no country prefix (digits only, no +). Example: "996" for Kyrgyzstan. */
  defaultCountryCode: string
  /** How many messages to send simultaneously (default 1 = sequential). */
  concurrency: number
  /** Delay in ms between messages within a sequence for the same contact (default 1500). */
  interMessageDelayMs?: number
  /** Minimum random delay in ms between contacts (0 = disabled). */
  delayMin?: number
  /** Maximum random delay in ms between contacts. When delayMin > 0 and delayMax > delayMin the actual delay per contact is randomized. */
  delayMax?: number
}

export interface ElectronAPI {
  sendMessages: (args: SendMessagesArgs) => Promise<void>
  cancelSend: () => void
  pauseSend: () => void
  resumeSend: () => void
  loadCredentials: (type: CredentialType) => Promise<unknown>
  saveCredentials: (type: CredentialType, data: unknown) => Promise<void>
  onProgress: (callback: (payload: ProgressPayload) => void) => () => void
  saveSettings: (settings: AppSettings) => Promise<void>
  loadSettings: () => Promise<AppSettings>
  onWhatsappQr: (callback: (qr: string) => void) => () => void
  getWhatsappQr: () => Promise<string | null>
  onWhatsappReady: (callback: () => void) => () => void
  onWhatsappDisconnected: (callback: () => void) => () => void
  getWhatsappReady: () => Promise<boolean>
  disconnectWhatsapp: () => Promise<void>
  listAccounts: (type?: CredentialType) => Promise<import('./accounts').Account[]>
  saveAccount: (account: import('./accounts').Account) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  getAccount: (id: string) => Promise<import('./accounts').Account | undefined>
  listSmtpPresets: () => Promise<import('./smtpPresets').SmtpPreset[]>
  saveSmtpPreset: (preset: import('./smtpPresets').SmtpPreset) => Promise<void>
  deleteSmtpPreset: (id: string) => Promise<void>
  onInstagramStatus: (callback: (status: 'connected' | 'error') => void) => () => void
  requestInstagramConnect: (accountId: string) => Promise<{ status: 'connected' | 'challenge_required', sessionData?: string, contactPoint?: string }>
  completeInstagramChallenge: (accountId: string, code: string) => Promise<string>
  requestTelegramUserCode: (accountId: string) => Promise<void>
  completeTelegramUserLogin: (accountId: string, code: string) => Promise<string>
  completeTelegramUser2FA: (accountId: string, password: string) => Promise<string>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
