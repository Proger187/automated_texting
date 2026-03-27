import { create } from 'zustand'
import type { CredentialType } from '../types/ipc'

// ── Send state types (used by Modules 6 & 7) ──────────────────────────────────

export interface SendResultEntry {
  contact: string
  success: boolean
  error?: string
  renderedMessage?: string
  timestamp?: string
}

export type SendStatus = 'idle' | 'running' | 'paused' | 'completed'

export interface SendState {
  status: SendStatus
  index: number
  total: number
  results: SendResultEntry[]
  successCount: number
  failCount: number
}

const initialSendState: SendState = {
  status: 'idle',
  index: 0,
  total: 0,
  results: [],
  successCount: 0,
  failCount: 0,
}

// ── Store shape ────────────────────────────────────────────────────────────────

export interface AppState {
  // Excel import (Module 2)
  contacts: Record<string, string>[]
  headers: string[]
  contactField: string
  variableFields: string[]
  filename: string

  // Message composition (Module 4)
  template: string
  /** Ordered sequence of messages to send to each contact (F7). */
  messageSequence: string[]
  /** Email subject line (only used when adapterType === 'email') */
  emailSubject: string

  // Messaging adapter (Module 3 / 5)
  adapterType: CredentialType
  credentials: unknown

  // Send progress (Module 6 / 7)
  sendState: SendState

  // Adapters that have credentials stored (Module 8 step-validation)
  credentialsSavedFor: CredentialType[]

  // Selected sender account (Fixture 1)
  selectedAccountId: string | null

  // ── Actions ─────────────────────────────────────────────────────────────────
  setImportData: (data: {
    contacts: Record<string, string>[]
    headers: string[]
    contactField: string
    variableFields: string[]
    filename: string
  }) => void
  setContactField: (field: string) => void
  setVariableFields: (fields: string[]) => void
  setTemplate: (template: string) => void
  setMessageSequence: (messages: string[]) => void
  setEmailSubject: (subject: string) => void
  setAdapterType: (type: CredentialType) => void
  setCredentials: (credentials: unknown) => void
  setSendState: (partial: Partial<SendState>) => void
  markCredentialsSaved: (type: CredentialType) => void
  setSelectedAccountId: (id: string | null) => void
  resetStore: () => void
}

// ── Initial values ─────────────────────────────────────────────────────────────

const initialState = {
  contacts: [] as Record<string, string>[],
  headers: [] as string[],
  contactField: '',
  variableFields: [] as string[],
  filename: '',
  template: '',
  messageSequence: [''] as string[],
  emailSubject: '',
  adapterType: 'email' as CredentialType,
  credentials: null as unknown,
  sendState: initialSendState,
  credentialsSavedFor: [] as CredentialType[],
  selectedAccountId: null as string | null,
}

// ── Store ──────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setImportData: (data) =>
    set({
      contacts: data.contacts,
      headers: data.headers,
      contactField: data.contactField,
      variableFields: data.variableFields,
      filename: data.filename,
    }),

  setContactField: (field) => set({ contactField: field }),

  setVariableFields: (fields) => set({ variableFields: fields }),

  setTemplate: (template) => set((prev) => ({
    template,
    messageSequence: prev.messageSequence.length > 0
      ? [template, ...prev.messageSequence.slice(1)]
      : [template],
  })),

  setMessageSequence: (messageSequence) => set({
    messageSequence,
    template: messageSequence[0] ?? '',
  }),

  setEmailSubject: (emailSubject) => set({ emailSubject }),

  setAdapterType: (type) => set({ adapterType: type }),

  setCredentials: (credentials) => set({ credentials }),

  setSendState: (partial) =>
    set((prev) => ({ sendState: { ...prev.sendState, ...partial } })),

  markCredentialsSaved: (type) =>
    set((prev) => ({
      credentialsSavedFor: prev.credentialsSavedFor.includes(type)
        ? prev.credentialsSavedFor
        : [...prev.credentialsSavedFor, type],
    })),

  setSelectedAccountId: (id) => set({ selectedAccountId: id }),

  resetStore: () => set(initialState),
}))
