import { describe, it, expect } from 'vitest'
import {
  INITIAL_POLL_DELAY,
  MAX_POLL_DELAY,
  MAX_RETRY_AFTER,
  shouldKeepPolling,
  nextPollDelay,
  retryAfterMs
} from '@/utils/pdfPolling'

function responseWith(headers) {
  return { headers: { get: name => headers[name] ?? null } }
}

describe('pdfPolling', () => {
  it('only keeps polling while a build is running', () => {
    expect(shouldKeepPolling('building')).toBe(true)
    for (const s of ['idle', 'ready', 'error', null, undefined]) {
      expect(shouldKeepPolling(s)).toBe(false)
    }
  })

  it('backs off geometrically and caps the delay', () => {
    let d = INITIAL_POLL_DELAY
    const seen = []
    for (let i = 0; i < 10; i++) { d = nextPollDelay(d); seen.push(d) }
    expect(seen[0]).toBeGreaterThan(INITIAL_POLL_DELAY)
    expect(seen.every((v, i) => i === 0 || v >= seen[i - 1])).toBe(true)
    expect(seen[seen.length - 1]).toBe(MAX_POLL_DELAY)
    expect(nextPollDelay(undefined)).toBe(nextPollDelay(INITIAL_POLL_DELAY))
  })

  it('honours Retry-After in seconds', () => {
    expect(retryAfterMs(responseWith({ 'Retry-After': '120' }))).toBe(120000)
  })

  it('honours Retry-After as an HTTP date', () => {
    const now = Date.parse('2026-09-02T12:00:00Z')
    const at = new Date(now + 90000).toUTCString()
    expect(retryAfterMs(responseWith({ 'Retry-After': at }), now)).toBe(90000)
  })

  it('falls back to RateLimit-Reset, then to the max poll delay', () => {
    expect(retryAfterMs(responseWith({ 'RateLimit-Reset': '45' }))).toBe(45000)
    expect(retryAfterMs(responseWith({}))).toBe(MAX_POLL_DELAY)
    expect(retryAfterMs(null)).toBe(MAX_POLL_DELAY)
  })

  it('never waits less than a second or longer than the cap', () => {
    expect(retryAfterMs(responseWith({ 'Retry-After': '0' }))).toBe(1000)
    expect(retryAfterMs(responseWith({ 'Retry-After': '99999' }))).toBe(MAX_RETRY_AFTER)
  })
})
