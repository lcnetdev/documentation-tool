/**
 * Theme toggle utility.
 * Stores preference in localStorage and applies a `data-theme` attribute on <html>.
 */

const STORAGE_KEY = 'doc-theme'

export function getTheme() {
  return localStorage.getItem(STORAGE_KEY) || 'light'
}

export function setTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme)
}

export function toggleTheme() {
  const next = getTheme() === 'light' ? 'dark' : 'light'
  setTheme(next)
  return next
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme || getTheme())
}

// Apply saved theme on import
applyTheme()
