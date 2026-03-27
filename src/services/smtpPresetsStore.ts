import Store from 'electron-store'
import type { SmtpPreset } from '../types/smtpPresets'

const store = new Store<{ presets: SmtpPreset[] }>({
  name: 'smtpPresets',
  defaults: { presets: [] },
})

const GMAIL_PRESET: SmtpPreset = {
  id: 'gmail',
  name: 'Gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  isBuiltIn: true,
}

// Seed built-in Gmail preset on first run; migrate from old Moosend preset.
function ensureSeeded(): void {
  const all = store.get('presets')
  // Remove legacy Moosend built-in if present
  const withoutMoosend = all.filter((p) => p.id !== 'moosend')
  // Add Gmail if not already present
  if (!withoutMoosend.find((p) => p.id === 'gmail')) {
    withoutMoosend.unshift(GMAIL_PRESET)
  }
  if (withoutMoosend.length !== all.length || !all.find((p) => p.id === 'gmail')) {
    store.set('presets', withoutMoosend)
  }
}

ensureSeeded()

export function listSmtpPresets(): SmtpPreset[] {
  return store.get('presets')
}

export function saveSmtpPreset(preset: SmtpPreset): void {
  // Built-in presets cannot be overwritten
  const existing = store.get('presets').find((p) => p.id === preset.id)
  if (existing?.isBuiltIn) return

  const all = store.get('presets')
  const idx = all.findIndex((p) => p.id === preset.id)
  if (idx >= 0) {
    all[idx] = preset
  } else {
    all.push(preset)
  }
  store.set('presets', all)
}

export function deleteSmtpPreset(id: string): void {
  const all = store.get('presets')
  const target = all.find((p) => p.id === id)
  if (!target || target.isBuiltIn) return
  store.set('presets', all.filter((p) => p.id !== id))
}
