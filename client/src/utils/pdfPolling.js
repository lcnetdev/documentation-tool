/**
 * Polling policy for the manual-PDF build status.
 *
 * The server builds the whole-manual PDF in the background and reports
 * idle | building | ready | error. The viewer only needs to keep asking while
 * a build is actually running; every other state is final until something
 * changes on the server. Polling forever (the old behaviour) drained the
 * shared API rate-limit budget and turned ordinary page loads into 429s.
 */

export const INITIAL_POLL_DELAY = 5000
export const MAX_POLL_DELAY = 30000
export const BACKOFF_FACTOR = 1.5
/** Upper bound on how long a 429 can push the next check out. */
export const MAX_RETRY_AFTER = 5 * 60 * 1000

/** Only a running build warrants another status check. */
export function shouldKeepPolling(status) {
  return status === 'building'
}

/** Grow the wait between checks, capped so a long build is still noticed promptly. */
export function nextPollDelay(previous) {
  const base = Number.isFinite(previous) && previous > 0 ? previous : INITIAL_POLL_DELAY
  return Math.min(MAX_POLL_DELAY, Math.round(base * BACKOFF_FACTOR))
}

/**
 * How long to wait after a 429 before asking again, in milliseconds.
 * Honours Retry-After (seconds or HTTP date) and the draft-standard
 * RateLimit-Reset (seconds) header that express-rate-limit sends.
 */
export function retryAfterMs(response, now = Date.now()) {
  const headers = response && response.headers
  const get = name => (headers && typeof headers.get === 'function' ? headers.get(name) : null)

  const retryAfter = get('Retry-After')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds)) return clamp(seconds * 1000)
    const at = Date.parse(retryAfter)
    if (!Number.isNaN(at)) return clamp(at - now)
  }

  const reset = Number(get('RateLimit-Reset'))
  if (Number.isFinite(reset) && reset > 0) return clamp(reset * 1000)

  return MAX_POLL_DELAY
}

function clamp(ms) {
  return Math.min(MAX_RETRY_AFTER, Math.max(1000, ms))
}
