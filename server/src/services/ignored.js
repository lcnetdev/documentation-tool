/**
 * Some folders live in a docs repo but hold no documentation (conversion
 * scripts, source documents, build artefacts). These stay out of the file
 * tree, the search index and the public file routes. Set them with
 * IGNORED_DIRS (comma-separated); defaults to meta-conversion.
 */
const config = require('../config');

const ALWAYS_IGNORED = ['.git'];

function ignoredDirNames() {
  return ALWAYS_IGNORED.concat(config.ignoredDirs || []);
}

/** Whether a directory entry should be passed over while walking a repo. */
function isIgnoredDir(name) {
  return ignoredDirNames().includes(name);
}

/**
 * True when some segment of a relative path is a dotfile/dot-directory
 * (.git, .pdf-cache, .env, .gitignore, ...) or one of the ignored folders.
 * Public routes must never serve these.
 */
function isIgnoredPath(relPath) {
  const ignored = ignoredDirNames();
  return String(relPath)
    .split(/[\\/]+/)
    .some((seg) => seg.startsWith('.') || ignored.includes(seg));
}

module.exports = { isIgnoredDir, isIgnoredPath, ignoredDirNames };
