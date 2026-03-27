import { render } from './templateEngine'
import { getAdapter } from '../adapters/index'
import { delay } from './rateLimiter'
import { validateContact } from './contactValidator'
import type { CredentialType, ProgressPayload } from '../types/ipc'

// ── Public types ───────────────────────────────────────────────────────────────

export interface SendResultEntry {
  contact: string
  success: boolean
  error?: string
}

export interface QueueResult {
  results: SendResultEntry[]
  total: number
  successCount: number
  failCount: number
}

export interface QueueOptions {
  contacts: Record<string, string>[]
  contactField: string
  template: string
  adapterType: CredentialType
  credentials: unknown
  delayMs: number
  defaultCountryCode?: string
  /** Max simultaneous sends. Default 1 (sequential). */
  concurrency?: number
  /** Subject line forwarded to the email adapter. */
  emailSubject?: string
  /** Ordered sequence of message templates per contact. Falls back to [template] if absent. */
  messageSequence?: string[]
  /** Delay in ms between messages within a sequence for the same contact (default 1500). */
  interMessageDelayMs?: number
  onProgress: (p: ProgressPayload) => void
  onComplete: (r: QueueResult) => void
}

// ── Module-level queue state ───────────────────────────────────────────────────

let paused = false
let cancelled = false
let pauseResolve: (() => void) | null = null

function waitForResume(): Promise<void> {
  return new Promise((resolve) => {
    pauseResolve = resolve
  })
}

// ── Control functions ──────────────────────────────────────────────────────────

export function pauseQueue(): void {
  paused = true
}

export function resumeQueue(): void {
  paused = false
  if (pauseResolve) {
    pauseResolve()
    pauseResolve = null
  }
}

export function cancelQueue(): void {
  cancelled = true
  resumeQueue() // unblock pause gate so dispatching loop exits
}

// ── Semaphore ─────────────────────────────────────────────────────────────────

class Semaphore {
  private slots: number
  private readonly waiters: Array<() => void> = []

  constructor(max: number) {
    this.slots = max
  }

  acquire(): Promise<void> {
    if (this.slots > 0) {
      this.slots--
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      this.waiters.push(resolve)
    })
  }

  release(): void {
    const next = this.waiters.shift()
    if (next) {
      next()
    } else {
      this.slots++
    }
  }
}

// ── Main queue runner ─────────────────────────────────────────────────────────

export async function startQueue(options: QueueOptions): Promise<void> {
  const {
    contacts,
    contactField,
    template,
    adapterType,
    credentials,
    delayMs,
    defaultCountryCode,
    concurrency = 1,
    emailSubject,
    messageSequence,
    interMessageDelayMs = 1500,
    onProgress,
    onComplete,
  } = options

  // Reset flags for a fresh run
  paused = false
  cancelled = false
  pauseResolve = null

  const total = contacts.length
  const results: SendResultEntry[] = new Array(total)
  let completed = 0
  let successCount = 0
  let failCount = 0

  const adapter = getAdapter(adapterType)
  const sem = new Semaphore(Math.max(1, concurrency))

  // Returns a Promise that runs a single contact send end-to-end
  async function processContact(i: number): Promise<void> {
    await sem.acquire()
    try {
      const contactRow = contacts[i]
      const contactValue = contactRow[contactField] ?? ''

      // a. Validate / normalise contact
      const validation = validateContact(contactValue, adapterType, defaultCountryCode)
      if (!validation.valid) {
        const entry: SendResultEntry = { contact: contactValue, success: false, error: validation.error }
        results[i] = entry
        failCount++
        completed++
        onProgress({
          index: completed,
          total,
          contact: contactValue,
          success: false,
          error: validation.error,
          done: completed === total,
        })
        return
      }

      const resolvedContact = validation.normalized

      // b. Build message list (falls back to single template if no sequence provided)
      const msgList = (messageSequence?.filter((m) => m.trim().length > 0) ?? []).length > 0
        ? messageSequence!.filter((m) => m.trim().length > 0)
        : [template]

      // c. Send each message in sequence
      let contactSuccess = true
      let contactError: string | undefined

      for (let msgIdx = 0; msgIdx < msgList.length; msgIdx++) {
        if (cancelled) {
          contactSuccess = false
          contactError = 'Cancelled'
          break
        }
        if (paused) {
          await waitForResume()
          if (cancelled) {
            contactSuccess = false
            contactError = 'Cancelled'
            break
          }
        }

        const rendered = render(msgList[msgIdx], contactRow)
        const sendResult = await adapter.send(resolvedContact, rendered, credentials, emailSubject)

        if (!sendResult.success) {
          contactSuccess = false
          contactError = sendResult.error
          break
        }

        // Inter-message delay — applied between messages, not after the last one
        if (msgIdx < msgList.length - 1) {
          await delay(interMessageDelayMs)
        }
      }

      const entry: SendResultEntry = {
        contact: contactValue,
        success: contactSuccess,
        ...(contactError ? { error: contactError } : {}),
      }
      results[i] = entry

      if (contactSuccess) successCount++
      else failCount++

      completed++

      // d. Emit progress (once per contact, after all messages)
      onProgress({
        index: completed,
        total,
        contact: contactValue,
        success: contactSuccess,
        error: contactError,
        done: completed === total,
      })
    } finally {
      sem.release()
    }
  }

  // ── Dispatch loop: feed contacts into the semaphore-limited pool ─────────────
  const inFlight: Promise<void>[] = []

  for (let i = 0; i < total; i++) {
    // Pause gate — stop dispatching new work while paused
    if (paused) {
      await waitForResume()
    }

    // Cancel gate — stop dispatching; in-flight sends will finish naturally
    if (cancelled) {
      onProgress({
        index: completed,
        total,
        contact: contacts[i]?.[contactField] ?? '',
        success: false,
        done: true,
      })
      break
    }

    inFlight.push(processContact(i))

    // Inter-dispatch delay (rate-limiting between slot starts)
    if (delayMs > 0 && i < total - 1) {
      await delay(delayMs)
    }
  }

  // Wait for every in-flight send to finish before calling onComplete
  await Promise.allSettled(inFlight)

  onComplete({
    results: results.filter(Boolean),
    total,
    successCount,
    failCount,
  })
}

