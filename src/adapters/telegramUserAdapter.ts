import { TelegramClient, sessions } from 'telegram'

const { StringSession } = sessions
import type { IMessagingAdapter, SendResult } from './types'
import type { TelegramUserCredentials } from '../types/accounts'

// ── Module-level state ─────────────────────────────────────────────────────────

/** Active GramJS clients keyed by phone number */
const clientCache = new Map<string, TelegramClient>()

// ── Public init function ───────────────────────────────────────────────────────

/**
 * Initialise a Telegram user session via the MTProto API (GramJS).
 * Calls client.start() using the supplied callbacks for interactive auth.
 *
 * @returns The serialised StringSession string — persist in TelegramUserCredentials.sessionString
 */
export async function initTelegramUser(
  creds: TelegramUserCredentials,
  onCodeRequired: () => Promise<string>,
  onPasswordRequired: (hint?: string) => Promise<string>,
): Promise<string> {
  const session = new StringSession(creds.sessionString ?? '')
  const client = new TelegramClient(session, creds.apiId, creds.apiHash, {
    connectionRetries: 3,
  })

  await client.start({
    phoneNumber: creds.phone,
    // phoneCode has signature (isCodeViaApp?: boolean) => Promise<string>;
    // () => Promise<string> is compatible (TypeScript allows fewer params)
    phoneCode: onCodeRequired,
    password: onPasswordRequired,
    onError: (err: Error) => {
      console.error('[TelegramUser] auth error:', err.message)
    },
  })

  const sessionStr = session.save()
  clientCache.set(creds.phone, client)
  return sessionStr
}

// ── Adapter ────────────────────────────────────────────────────────────────────

export const telegramUserAdapter: IMessagingAdapter = {
  async send(
    contact: string,
    message: string,
    credentials: unknown,
  ): Promise<SendResult> {
    const creds = credentials as TelegramUserCredentials

    // Obtain or restore client
    let client = clientCache.get(creds.phone)
    if (!client) {
      if (!creds.sessionString) {
        return {
          success: false,
          error: 'Telegram user account not connected. Use the Connect button in the Account Manager.',
        }
      }
      try {
        const session = new StringSession(creds.sessionString)
        client = new TelegramClient(session, creds.apiId, creds.apiHash, {
          connectionRetries: 3,
        })
        // Use start() not connect() — connect() only opens TCP, it does NOT
        // replay the MTProto authentication handshake.  start() will reuse the
        // stored session silently when it is still valid.  If the session has
        // expired the callbacks below throw immediately so the error is clear.
        await client.start({
          phoneNumber: creds.phone,
          phoneCode: async () => {
            throw new Error('Session expired. Re-connect in Account Manager.')
          },
          password: async () => {
            throw new Error('Session expired. Re-connect in Account Manager.')
          },
          onError: (err: Error) => {
            console.error('[TelegramUser] session restore error:', err.message)
          },
        })
        clientCache.set(creds.phone, client)
      } catch (err) {
        return {
          success: false,
          error: `Session restore failed: ${err instanceof Error ? err.message : String(err)}`,
        }
      }
    }

    try {
      // Resolve contact entity:
      // - All-digit string → treat as numeric user/chat ID
      // - @username or phone number → pass as string (GramJS resolves it)
      const entity: string | number = /^\d+$/.test(contact)
        ? parseInt(contact, 10)
        : contact

      await client.sendMessage(entity, { message })
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  },
}
