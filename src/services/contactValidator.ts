import type { CredentialType } from '../types/ipc'

// ── Result types ───────────────────────────────────────────────────────────────

export interface ValidContact {
  valid: true
  /** Normalized form ready to pass to the adapter. */
  normalized: string
}

export interface InvalidContact {
  valid: false
  error: string
}

export type ContactValidationResult = ValidContact | InvalidContact

// ── WhatsApp / phone ───────────────────────────────────────────────────────────

/**
 * Normalize a phone number to a plain digit string suitable for WhatsApp
 * (digits only, no +, spaces, dashes, parentheses).
 *
 * Handles common real-world formats:
 *   +996 XXX XXXXXX   →  996XXXXXXXXX
 *   996-XXX-XXXXXX    →  996XXXXXXXXX
 *   00996XXXXXXXXX    →  996XXXXXXXXX
 *   0XXXXXXXXX        →  <defaultCountryCode>XXXXXXXXX  (if code provided)
 *   79XXXXXXXX        →  79XXXXXXXX  (already has country code)
 */
export function normalizePhone(
  raw: string,
  defaultCountryCode?: string,
): ContactValidationResult {
  if (!raw || !raw.trim()) {
    return { valid: false, error: 'Contact is empty' }
  }

  let cleaned = raw.trim()

  // Remove common formatting characters
  cleaned = cleaned.replace(/[\s\-\.\(\)\_]/g, '')

  // Strip leading "+" international prefix
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1)
  }

  // Strip leading "00" international prefix (e.g. 00996…)
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.slice(2)
  }

  // Remove any remaining non-digit characters
  cleaned = cleaned.replace(/\D/g, '')

  if (cleaned.length === 0) {
    return { valid: false, error: 'Contact contains no digits' }
  }

  // If the number looks like a local number (< 10 digits) and we have a
  // default country code, prepend it.
  if (cleaned.length < 10 && defaultCountryCode) {
    const cc = defaultCountryCode.replace(/\D/g, '')
    if (cc) {
      cleaned = cc + cleaned
    }
  }

  // ITU-T E.164 allows 7–15 digits total (without the + prefix)
  if (cleaned.length < 7) {
    return {
      valid: false,
      error: `Phone number too short: "${raw}" → parsed as "${cleaned}" (${cleaned.length} digits, minimum 7)`,
    }
  }
  if (cleaned.length > 15) {
    return {
      valid: false,
      error: `Phone number too long: "${raw}" → "${cleaned}" (${cleaned.length} digits, maximum 15)`,
    }
  }

  return { valid: true, normalized: cleaned }
}

// ── Email ──────────────────────────────────────────────────────────────────────

export function validateEmail(raw: string): ContactValidationResult {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { valid: false, error: 'Email address is empty' }
  }
  // Reasonable RFC 5321 subset: name@domain.tld
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
    return { valid: true, normalized: trimmed }
  }
  return { valid: false, error: `Invalid email address: "${trimmed}"` }
}

// ── Instagram ────────────────────────────────────────────────────────────────

/**
 * Strip full Instagram profile URLs to bare username or numeric ID.
 *   https://www.instagram.com/username/  →  username
 *   instagram.com/username               →  username
 *   @username                            →  username
 *   123456789                            →  123456789  (numeric user ID)
 */
export function normalizeInstagram(raw: string): string {
  let s = raw.trim()
  // Strip protocol
  s = s.replace(/^https?:\/\//i, '')
  // Strip www.
  s = s.replace(/^www\./i, '')
  // Strip instagram.com/
  s = s.replace(/^instagram\.com\//i, '')
  // Strip trailing slashes, query strings, fragments
  s = s.replace(/[/?#].*$/, '')
  // Strip leading @
  s = s.replace(/^@+/, '')
  return s
}

function normalizeInstagramContact(raw: string): ContactValidationResult {
  if (!raw.trim()) return { valid: false, error: 'Instagram contact cannot be empty.' }
  const normalized = normalizeInstagram(raw)
  if (!normalized) return { valid: false, error: 'Instagram contact cannot be empty.' }
  // Valid: numeric ID (any length), or 1–30 char username (letters/digits/underscores/periods)
  if (/^\d+$/.test(normalized) || /^[a-zA-Z0-9._]{1,30}$/.test(normalized)) {
    return { valid: true, normalized }
  }
  return { valid: false, error: `Invalid Instagram username: "${raw}"` }
}

// ── Telegram ───────────────────────────────────────────────────────────────────

/**
 * Normalise any Telegram contact input to a canonical @username or numeric ID.
 *
 * Accepted inputs (all produce the same result):
 *   @username               → @username
 *   username                → @username
 *   t.me/username           → @username
 *   https://t.me/username   → @username
 *   http://t.me/username    → @username
 *   telegram.me/username    → @username
 *   123456789               → 123456789  (numeric ID — left as-is)
 */
export function normalizeTelegram(raw: string): string {
  // a. trim whitespace
  let s = raw.trim()

  // b. All-digit string → numeric chat/user ID, return as-is
  if (/^\d+$/.test(s)) {
    return s
  }

  // c. Strip protocol prefix
  s = s.replace(/^https?:\/\//i, '')

  // d. Strip t.me / telegram.me domain prefix
  s = s.replace(/^(t\.me|telegram\.me)\//i, '')

  // e. Strip any leading @, then re-add exactly one
  s = s.replace(/^@+/, '')

  // f. Lowercase (Telegram usernames are case-insensitive)
  s = s.toLowerCase()

  return '@' + s
}

export function validateTelegramContact(raw: string): ContactValidationResult {
  if (!raw.trim()) {
    return { valid: false, error: 'Telegram contact is empty' }
  }

  const candidate = normalizeTelegram(raw)

  // Valid: @username with 5–32 alphanumeric/underscore chars
  if (/^@[a-z0-9_]{5,32}$/.test(candidate)) {
    return { valid: true, normalized: candidate }
  }

  // Valid: numeric-only ID with 5–15 digits
  if (/^\d{5,15}$/.test(candidate)) {
    return { valid: true, normalized: candidate }
  }

  return {
    valid: false,
    error: `Invalid Telegram username or ID: "${raw}"`,
  }
}

// ── Unified entry point ────────────────────────────────────────────────────────

export function validateContact(
  raw: string,
  adapterType: CredentialType,
  defaultCountryCode?: string,
): ContactValidationResult {
  switch (adapterType) {
    case 'whatsapp':
      return normalizePhone(raw, defaultCountryCode)
    case 'telegram':
    case 'telegramUser':
      return validateTelegramContact(raw)
    case 'email':
      return validateEmail(raw)
    case 'instagram':
      return normalizeInstagramContact(raw)
    default:
      return { valid: true, normalized: raw.trim() }
  }
}

// ── normalizeTelegram assertions (self-documenting, no test runner needed) ─────
// normalizeTelegram('@username') === '@username'
// normalizeTelegram('username') === '@username'
// normalizeTelegram('t.me/username') === '@username'
// normalizeTelegram('https://t.me/username') === '@username'
// normalizeTelegram('http://t.me/username') === '@username'
// normalizeTelegram('telegram.me/username') === '@username'
// normalizeTelegram('T.ME/Username') === '@username'       (case-insensitive domain + lowercase result)
// normalizeTelegram('@@@username') === '@username'          (multiple leading @ stripped)
// normalizeTelegram('123456789') === '123456789'            (numeric ID left as-is)
// normalizeTelegram('  https://t.me/MyBot  ') === '@mybot' (trims whitespace, lowercases)
// normalizeTelegram('TELEGRAM.ME/SomeUser') === '@someuser' (old-style domain + lowercase)
