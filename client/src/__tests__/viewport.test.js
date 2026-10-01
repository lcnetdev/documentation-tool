import { describe, it, expect, vi } from 'vitest'
import { MOBILE_MEDIA_QUERY, mobileMediaQuery, watchMediaQuery } from '@/utils/viewport'

describe('mobileMediaQuery', () => {
  it('asks matchMedia about the mobile breakpoint', () => {
    const mq = { matches: true }
    const win = { matchMedia: vi.fn(() => mq) }
    expect(mobileMediaQuery(win)).toBe(mq)
    expect(win.matchMedia).toHaveBeenCalledWith(MOBILE_MEDIA_QUERY)
    expect(MOBILE_MEDIA_QUERY).toBe('(max-width: 900px)')
  })

  it('never matches where matchMedia is unavailable', () => {
    const mq = mobileMediaQuery({})
    expect(mq.matches).toBe(false)
    expect(() => watchMediaQuery(mq, () => {})()).not.toThrow()
  })
})

describe('watchMediaQuery', () => {
  it('reports changes and stops on request', () => {
    const listeners = new Set()
    const query = {
      addEventListener: (_type, fn) => listeners.add(fn),
      removeEventListener: (_type, fn) => listeners.delete(fn)
    }
    const handler = vi.fn()
    const stop = watchMediaQuery(query, handler)
    listeners.forEach(fn => fn({ matches: true }))
    expect(handler).toHaveBeenCalledWith(true)
    stop()
    expect(listeners.size).toBe(0)
  })

  it('falls back to addListener on older browsers', () => {
    let listener = null
    const query = { addListener: fn => { listener = fn }, removeListener: () => { listener = null } }
    const handler = vi.fn()
    const stop = watchMediaQuery(query, handler)
    listener({ matches: false })
    expect(handler).toHaveBeenCalledWith(false)
    stop()
    expect(listener).toBeNull()
  })
})
