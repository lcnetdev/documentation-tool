import { describe, it, expect } from 'vitest'
import { resolveIndexRedirect } from '@/utils/indexRedirect'

describe('resolveIndexRedirect', () => {
  it('sends directory URLs to their index.md', () => {
    const result = resolveIndexRedirect({ name: 'viewer', path: '/view/repo/Reference/', query: { q: '1' }, hash: '#top' })
    expect(result).toEqual({ path: '/view/repo/Reference/index.md', query: { q: '1' }, hash: '#top', replace: true })
  })

  it('sends the bare repo URL to the homepage in the editor too', () => {
    expect(resolveIndexRedirect({ name: 'editor', path: '/edit/repo/', query: {}, hash: '' }).path).toBe('/edit/repo/index.md')
  })

  it('leaves file URLs and other routes alone', () => {
    expect(resolveIndexRedirect({ name: 'viewer', path: '/view/repo/Reference/index.md', query: {}, hash: '' })).toBeNull()
    expect(resolveIndexRedirect({ name: 'home', path: '/', query: {}, hash: '' })).toBeNull()
  })
})
