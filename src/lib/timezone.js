/**
 * ROSTER is a Philippines-based operation, so every date/time shown or
 * captured in the UI is locked to Asia/Manila (UTC+8) — regardless of
 * the browser's/device's local timezone. Manila has no DST, so the
 * offset is always a flat +08:00, which keeps the conversions below
 * simple and exact.
 *
 * Database values stay as `timestamptz` (true UTC instants) — only the
 * *display* and *input* layers are pinned to Manila. See
 * supabase/schema.sql for the matching `set timezone` pin on the
 * database session side.
 */

export const MANILA_TZ = 'Asia/Manila'
const MANILA_OFFSET = '+08:00'

/**
 * Convert a stored timestamptz value (ISO string, Date, or null) into
 * the "YYYY-MM-DDTHH:mm" shape an <input type="datetime-local"> needs,
 * expressed in Manila wall-clock time.
 */
export function toManilaInputValue(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(date)

  const get = (type) => parts.find(p => p.type === type)?.value
  // en-CA gives 24 as a valid hour for midnight in some engines; normalize.
  let hour = get('hour')
  if (hour === '24') hour = '00'

  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}

/**
 * Convert a "YYYY-MM-DDTHH:mm" value from a datetime-local input
 * (interpreted as Manila wall-clock time, since that's what we always
 * display) into a proper UTC ISO string for storage.
 */
export function manilaInputToISOString(inputValue) {
  if (!inputValue) return null
  // inputValue already looks like 2026-01-01T10:00 — just attach the
  // fixed Manila offset and let Date do the UTC conversion.
  const withSeconds = inputValue.length === 16 ? `${inputValue}:00` : inputValue
  const date = new Date(`${withSeconds}${MANILA_OFFSET}`)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

/** Human-readable Manila-time display for a stored timestamptz value. */
export function formatManila(value, opts = {}) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA_TZ,
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    ...opts
  }).format(date)
}

/** Today's date (Manila) as "YYYY-MM-DD". */
export function todayManila() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: MANILA_TZ }).format(new Date())
}

/**
 * Is `dateOfBirth` (a "YYYY-MM-DD" string, year ignored) within the
 * current Sunday–Saturday week, evaluated in Manila time?
 */
export function isBirthdayWeek(dateOfBirth) {
  if (!dateOfBirth) return false
  const [, bMonth, bDay] = dateOfBirth.split('-').map(Number)
  if (!bMonth || !bDay) return false

  const todayStr = todayManila()
  const [tYear, tMonth, tDay] = todayStr.split('-').map(Number)
  const today = new Date(Date.UTC(tYear, tMonth - 1, tDay))
  const weekStart = new Date(today)
  weekStart.setUTCDate(today.getUTCDate() - today.getUTCDay()) // Sunday
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6) // Saturday

  // Compare the birthday (this year, and if the week wraps a year
  // boundary, also check next/prev year) against the week window.
  for (const y of [tYear - 1, tYear, tYear + 1]) {
    const bday = new Date(Date.UTC(y, bMonth - 1, bDay))
    if (bday >= weekStart && bday <= weekEnd) return true
  }
  return false
}

/** Is `dateOfBirth`'s month/day exactly today, in Manila time? */
export function isBirthdayToday(dateOfBirth) {
  if (!dateOfBirth) return false
  const [, bMonth, bDay] = dateOfBirth.split('-').map(Number)
  const [, tMonth, tDay] = todayManila().split('-').map(Number)
  return bMonth === tMonth && bDay === tDay
}
