import type { CredentialType } from '../types/ipc'
import type { IMessagingAdapter } from './types'
import { telegramAdapter } from './telegramAdapter'
import { emailAdapter } from './emailAdapter'
import { whatsappAdapter } from './whatsappAdapter'
import { instagramAdapter } from './instagramAdapter'
import { telegramUserAdapter } from './telegramUserAdapter'

// ── Adapter registry ───────────────────────────────────────────────

const registry: Record<CredentialType, IMessagingAdapter> = {
  telegram: telegramAdapter,
  telegramUser: telegramUserAdapter,
  email: emailAdapter,
  whatsapp: whatsappAdapter,
  instagram: instagramAdapter,
}

export function getAdapter(type: CredentialType): IMessagingAdapter {
  return registry[type]
}
