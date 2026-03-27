import { IgApiClient } from 'instagram-private-api'
import type { IMessagingAdapter, SendResult } from './types'
import type { InstagramCredentials } from '../types/accounts'

// Module-level session cache — one login per process lifetime
let igClient: IgApiClient | null = null
let igClientUsername: string | null = null

// username → numeric userId look-up cache
const userIdCache = new Map<string, string>()

/** Allow main process to inject a freshly authenticated client (e.g. after challenge flow). */
export function setIgClient(ig: IgApiClient, username: string): void {
  igClient = ig
  igClientUsername = username
}

/**
 * Full login — creates a fresh IgApiClient, logs in, caches the client.
 * Returns the serialised session JSON string (caller should persist it).
 */
export async function initInstagram(username: string, password: string): Promise<string> {
  const ig = new IgApiClient()
  ig.state.generateDevice(username)
  await ig.account.login(username, password)
  igClient = ig
  igClientUsername = username

  // Serialise session for persistence
  const serialized = await ig.state.serialize()
  // Remove non-serializable Node-specific constants field
  delete (serialized as Record<string, unknown>).constants
  return JSON.stringify(serialized)
}

/**
 * Attempt to restore a previously serialised Instagram session without logging in again.
 * Returns true if the session is still alive, false if a full login is required.
 */
export async function tryRestoreInstagramSession(creds: InstagramCredentials): Promise<boolean> {
  if (!creds.sessionData) return false
  try {
    const ig = new IgApiClient()
    ig.state.generateDevice(creds.username)
    await ig.state.deserialize(JSON.parse(creds.sessionData))
    // Verify the session is alive
    await ig.account.currentUser()
    igClient = ig
    igClientUsername = creds.username
    return true
  } catch {
    return false
  }
}

export const instagramAdapter: IMessagingAdapter = {
  async send(contact: string, message: string, credentials: unknown): Promise<SendResult> {
    const creds = credentials as InstagramCredentials
    try {
      // Restore session or fall back to full login
      if (igClient === null || igClientUsername !== creds.username) {
        const restored = await tryRestoreInstagramSession(creds)
        if (!restored) {
          await initInstagram(creds.username, creds.password)
        }
      }
      const ig = igClient!

      let userId: string
      if (/^\d+$/.test(contact.trim())) {
        userId = contact.trim()
      } else {
        const key = contact.trim().toLowerCase()
        const cached = userIdCache.get(key)
        if (cached) {
          userId = cached
        } else {
          const user = await ig.user.searchExact(key)
          userId = user.pk.toString()
          userIdCache.set(key, userId)
        }
      }

      const thread = ig.entity.directThread([userId])
      await thread.broadcastText(message)
      return { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  },
}
