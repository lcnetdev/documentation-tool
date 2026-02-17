/**
 * Base path for the application, configured via VITE_BASE_PATH env var.
 * Defaults to '/' when not set. Always ends with '/'.
 * Used for constructing router paths, API URLs, and internal links.
 */
const raw = import.meta.env.BASE_URL || '/'
export const basePath = raw.endsWith('/') ? raw : raw + '/'

/**
 * Prefix an app-relative path with the base path.
 * e.g. withBase('view/repo/file.md') => '/docs/view/repo/file.md'
 */
export function withBase(path) {
  const clean = path.startsWith('/') ? path.slice(1) : path
  return basePath + clean
}
