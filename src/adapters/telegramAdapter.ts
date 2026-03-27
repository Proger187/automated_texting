import TelegramBot from 'node-telegram-bot-api'
import type { IMessagingAdapter, SendResult, TelegramCredentials } from './types'

export class TelegramAdapter implements IMessagingAdapter {
  async send(
    contact: string,
    message: string,
    credentials: unknown,
  ): Promise<SendResult> {
    const creds = credentials as TelegramCredentials

    if (!creds?.token) {
      return { success: false, error: 'Telegram token not configured' }
    }

    try {
      const bot = new TelegramBot(creds.token, { polling: false })
      await bot.sendMessage(contact, message)
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)

      // Surface common actionable errors
      if (msg.includes('401') || msg.includes('Unauthorized')) {
        return { success: false, error: 'Invalid Telegram token (401 Unauthorized)' }
      }
      if (msg.includes('400') && msg.includes('chat not found')) {
        return { success: false, error: `Chat not found for contact: ${contact}` }
      }
      if (msg.includes('429')) {
        return { success: false, error: 'Rate limited by Telegram (429). Increase delay.' }
      }

      return { success: false, error: msg }
    }
  }
}

export const telegramAdapter = new TelegramAdapter()
