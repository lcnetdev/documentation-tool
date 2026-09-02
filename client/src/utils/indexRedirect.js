/**
 * A viewer/editor URL that ends in "/" names a directory (or the repo itself);
 * it should land on that directory's index.md.
 *
 * @param {{ name?: string, path: string, query?: object, hash?: string }} to route location
 * @returns {object|null} a redirect location for vue-router, or null when no redirect applies
 */
export function resolveIndexRedirect(to) {
  if (to.name !== 'viewer' && to.name !== 'editor') return null
  if (!to.path.endsWith('/')) return null
  return { path: to.path + 'index.md', query: to.query, hash: to.hash, replace: true }
}
