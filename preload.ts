import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI, ProgressPayload, SendMessagesArgs, CredentialType, AppSettings } from './src/types/ipc'
import type { Account } from './src/types/accounts'
import type { SmtpPreset } from './src/types/smtpPresets'

const api: ElectronAPI = {
  sendMessages: (args: SendMessagesArgs): Promise<void> =>
    ipcRenderer.invoke('send-messages', args),

  cancelSend: (): void => {
    ipcRenderer.send('cancel-send')
  },

  pauseSend: (): void => {
    ipcRenderer.send('pause-send')
  },

  resumeSend: (): void => {
    ipcRenderer.send('resume-send')
  },

  loadCredentials: (type: CredentialType): Promise<unknown> =>
    ipcRenderer.invoke('load-credentials', type),

  saveCredentials: (type: CredentialType, data: unknown): Promise<void> =>
    ipcRenderer.invoke('save-credentials', type, data),

  onProgress: (callback: (payload: ProgressPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: ProgressPayload): void =>
      callback(payload)
    ipcRenderer.on('send-progress', listener)
    return () => {
      ipcRenderer.removeListener('send-progress', listener)
    }
  },

  saveSettings: (settings: AppSettings): Promise<void> =>
    ipcRenderer.invoke('save-settings', settings),

  loadSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke('load-settings'),

  onWhatsappQr: (callback: (qr: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, qr: string): void =>
      callback(qr)
    ipcRenderer.on('whatsapp-qr', listener)
    return () => {
      ipcRenderer.removeListener('whatsapp-qr', listener)
    }
  },

  getWhatsappQr: (): Promise<string | null> =>
    ipcRenderer.invoke('get-whatsapp-qr'),

  onWhatsappReady: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('whatsapp-ready', listener)
    return () => { ipcRenderer.removeListener('whatsapp-ready', listener) }
  },

  getWhatsappReady: (): Promise<boolean> =>
    ipcRenderer.invoke('get-whatsapp-ready'),

  disconnectWhatsapp: (): Promise<void> =>
    ipcRenderer.invoke('disconnect-whatsapp'),

  listAccounts: (type?: CredentialType): Promise<Account[]> =>
    ipcRenderer.invoke('list-accounts', type),

  saveAccount: (account: Account): Promise<void> =>
    ipcRenderer.invoke('save-account', account),

  deleteAccount: (id: string): Promise<void> =>
    ipcRenderer.invoke('delete-account', id),

  getAccount: (id: string): Promise<Account | undefined> =>
    ipcRenderer.invoke('get-account', id),

  listSmtpPresets: (): Promise<SmtpPreset[]> =>
    ipcRenderer.invoke('list-smtp-presets'),

  saveSmtpPreset: (preset: SmtpPreset): Promise<void> =>
    ipcRenderer.invoke('save-smtp-preset', preset),

  deleteSmtpPreset: (id: string): Promise<void> =>
    ipcRenderer.invoke('delete-smtp-preset', id),

  onInstagramStatus: (callback: (status: 'connected' | 'error') => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: 'connected' | 'error'): void =>
      callback(status)
    ipcRenderer.on('instagram-status', listener)
    return () => {
      ipcRenderer.removeListener('instagram-status', listener)
    }
  },

  requestInstagramConnect: (accountId: string): Promise<{ status: 'connected' | 'challenge_required', sessionData?: string, contactPoint?: string }> =>
    ipcRenderer.invoke('request-instagram-connect', accountId),

  completeInstagramChallenge: (accountId: string, code: string): Promise<string> =>
    ipcRenderer.invoke('complete-instagram-challenge', accountId, code),

  requestTelegramUserCode: (accountId: string): Promise<void> =>
    ipcRenderer.invoke('request-telegram-user-code', accountId),

  completeTelegramUserLogin: (accountId: string, code: string): Promise<string> =>
    ipcRenderer.invoke('complete-telegram-user-login', accountId, code),

  completeTelegramUser2FA: (accountId: string, password: string): Promise<string> =>
    ipcRenderer.invoke('complete-telegram-user-2fa', accountId, password),
}

contextBridge.exposeInMainWorld('electronAPI', api)
