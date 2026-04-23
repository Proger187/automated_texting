import Store from 'electron-store'
import type { CredentialType } from '../types/ipc'

interface SettingsSchema {
  delayMs: number
  defaultCountryCode: string
  concurrency: number
  interMessageDelayMs: number
  delayMin: number
  delayMax: number
}

// Shared settings store — also written by Module 8's 'save-settings' IPC handler
const settingsStore = new Store<SettingsSchema>({
  name: 'settings',
  defaults: { delayMs: 0, defaultCountryCode: '', concurrency: 1, interMessageDelayMs: 1500, delayMin: 0, delayMax: 0 },
})

/** Resolves after `ms` milliseconds. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Returns the effective delay in milliseconds for a given adapter type.
 * If the user has stored a positive override in electron-store it takes precedence.
 */
export function getDefaultDelay(adapterType: CredentialType): number {
  const override = settingsStore.get('delayMs')
  if (typeof override === 'number' && override > 0) return override

  switch (adapterType) {
    case 'whatsapp':      return 4000
    case 'telegram':      return 1000
    case 'telegramUser':  return 3000
    case 'instagram':     return 2000
    case 'email':         return 500
    default:              return 1000
  }
}

/** Persist a user-configured delay override (called from Module 8 IPC handler). */
export function saveDelayOverride(ms: number): void {
  settingsStore.set('delayMs', ms)
}

/** Read the persisted delay override. Returns 0 if none is set. */
export function loadDelayOverride(): number {
  return settingsStore.get('delayMs')
}

/** Persist a default country code (digits only, no +). */
export function saveDefaultCountryCode(code: string): void {
  settingsStore.set('defaultCountryCode', code)
}

/** Read the persisted default country code. Returns '' if none is set. */
export function loadDefaultCountryCode(): string {
  return settingsStore.get('defaultCountryCode')
}

/** Persist the concurrency setting (how many sends to run in parallel). */
export function saveConcurrency(n: number): void {
  settingsStore.set('concurrency', Math.max(1, Math.min(10, n)))
}

/** Read the persisted concurrency setting. Returns 1 (sequential) if not set. */
export function loadConcurrency(): number {
  return settingsStore.get('concurrency')
}

/** Persist the inter-message delay (ms between messages within a sequence for the same contact). */
export function saveInterMessageDelay(ms: number): void {
  settingsStore.set('interMessageDelayMs', Math.max(0, ms))
}

/** Read the persisted inter-message delay. Returns 1500 if not set. */
export function loadInterMessageDelay(): number {
  return settingsStore.get('interMessageDelayMs')
}

/** Persist the minimum random delay (0 = disabled). */
export function saveDelayMin(ms: number): void {
  settingsStore.set('delayMin', Math.max(0, ms))
}

/** Read the persisted minimum random delay. Returns 0 if not set. */
export function loadDelayMin(): number {
  return settingsStore.get('delayMin')
}

/** Persist the maximum random delay (0 = disabled). */
export function saveDelayMax(ms: number): void {
  settingsStore.set('delayMax', Math.max(0, ms))
}

/** Read the persisted maximum random delay. Returns 0 if not set. */
export function loadDelayMax(): number {
  return settingsStore.get('delayMax')
}

/**
 * Picks an actual delay from the configured range.
 * If `min > 0 && max > min`, returns a random integer in [min, max].
 * Otherwise falls back to the fixed `delayMs` value.
 */
export function resolveDelay(fixed: number, min: number, max: number): number {
  if (min > 0 && max > min) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
  return fixed
}
