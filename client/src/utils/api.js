import { withBase } from './basePath'

/**
 * Fetch wrapper that prepends the app base path to API URLs.
 * Use instead of `fetch('/api/...')` so requests work behind a reverse proxy.
 */
export function apiFetch(path, options) {
  return fetch(withBase(path), options)
}
