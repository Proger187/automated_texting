import type {
  WhatsAppCredentials,
  TelegramCredentials,
  EmailCredentials,
  Credentials,
} from '../services/credentialsStore'

// Re-export credential types so adapters only need to import from one place
export type { WhatsAppCredentials, TelegramCredentials, EmailCredentials, Credentials }

export interface SendResult {
  success: boolean
  error?: string
}

export interface IMessagingAdapter {
  send(
    contact: string,
    message: string,
    credentials: unknown,
    subject?: string,
  ): Promise<SendResult>
}
