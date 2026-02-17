/**
 * Compute a relative path from one file to another within the same repository.
 *
 * @param {string} fromFile - The source file path (e.g. "work-description/title-information.md")
 * @param {string} toFile - The target file path (e.g. "images/page018_img01.png")
 * @returns {string} The relative path (e.g. "../images/page018_img01.png")
 */
export function computeRelativePath(fromFile, toFile) {
  // Get directory parts for fromFile
  const fromParts = fromFile.split('/')
  fromParts.pop() // Remove filename to get directory
  const fromDir = fromParts

  // Get all parts of toFile
  const toParts = toFile.split('/')

  // Find common prefix length (comparing directory parts)
  let commonLength = 0
  const maxCommon = Math.min(fromDir.length, toParts.length - 1) // -1 because last part of toParts is the filename
  for (let i = 0; i < maxCommon; i++) {
    if (fromDir[i] === toParts[i]) {
      commonLength++
    } else {
      break
    }
  }

  // Build relative path
  const upCount = fromDir.length - commonLength
  const remainingParts = toParts.slice(commonLength)

  let relativePath = ''
  for (let i = 0; i < upCount; i++) {
    relativePath += '../'
  }

  relativePath += remainingParts.join('/')

  // If no up-navigation needed and result doesn't start with ./, add ./
  if (upCount === 0 && !relativePath.startsWith('./')) {
    relativePath = './' + relativePath
  }

  return relativePath
}

/**
 * Resolve a relative path against a current file path to get an absolute-from-repo-root path.
 *
 * @param {string} currentFile - The current file path (e.g. "work-description/title-information.md")
 * @param {string} relativePath - The relative path (e.g. "../images/foo.png")
 * @returns {string} The resolved path from repo root (e.g. "images/foo.png")
 */
export function resolveRelativePath(currentFile, relativePath) {
  // Get directory of current file
  const parts = currentFile.split('/')
  parts.pop() // Remove filename
  const dirParts = parts.filter(function (p) { return p.length > 0 })

  // Split the relative path
  const relParts = relativePath.split('/')

  // Start with the current directory parts
  const resultParts = dirParts.slice()

  for (let i = 0; i < relParts.length; i++) {
    const segment = relParts[i]
    if (segment === '..') {
      // Go up one level
      if (resultParts.length > 0) {
        resultParts.pop()
      }
    } else if (segment === '.' || segment === '') {
      // Stay in current directory, skip
      continue
    } else {
      resultParts.push(segment)
    }
  }

  return resultParts.join('/')
}
