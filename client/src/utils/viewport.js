/**
 * The phone/tablet breakpoint the viewer switches its navigation at: below
 * it the sidebar becomes an off-canvas drawer behind a menu button. Keep the
 * media queries in ViewerLayout.vue and NavSidebarItem.vue in step with it.
 */
export const MOBILE_BREAKPOINT = 900
export const MOBILE_MEDIA_QUERY = '(max-width: ' + MOBILE_BREAKPOINT + 'px)'

const noop = () => {}

/**
 * matchMedia for the mobile breakpoint, or an inert stand-in that never
 * matches where matchMedia is missing (jsdom, very old browsers).
 */
export function mobileMediaQuery(win = typeof window === 'undefined' ? undefined : window) {
  if (win && typeof win.matchMedia === 'function') return win.matchMedia(MOBILE_MEDIA_QUERY)
  return { matches: false, media: MOBILE_MEDIA_QUERY, addEventListener: noop, removeEventListener: noop }
}

/**
 * Calls `handler(matches)` whenever the query flips. Returns a function that
 * stops listening. Older Safari only has addListener/removeListener.
 */
export function watchMediaQuery(query, handler) {
  const listener = event => handler(!!event.matches)
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }
  if (typeof query.addListener === 'function') {
    query.addListener(listener)
    return () => query.removeListener(listener)
  }
  return noop
}
