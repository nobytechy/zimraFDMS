import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...args) {
  return twMerge(clsx(args))
}

/**
 * Normalise a Zimbabwean phone to a single canonical form: +263XXXXXXXXX.
 * Accepts: 0774603865, 774603865, +263774603865, 263774603865, with spaces or dashes.
 */
export function normalisePhone(raw) {
  if (!raw) return ''
  const digits = String(raw).replace(/[^\d]/g, '')
  if (!digits) return ''
  if (digits.startsWith('263')) return '+' + digits
  if (digits.startsWith('0'))   return '+263' + digits.slice(1)
  return '+263' + digits
}

export function phoneIsValid(raw) {
  const p = normalisePhone(raw)
  // +263 + 9 digits = 13 chars total
  return /^\+263\d{9}$/.test(p)
}

export function formatMoney(amount, currency = 'USD') {
  const n = Number(amount) || 0
  return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function shortRef(prefix = 'ZF') {
  return `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}${Date.now().toString(36).slice(-3).toUpperCase()}`
}
