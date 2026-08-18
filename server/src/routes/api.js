const express = require('express');
const path = require('path');
const config = require('../config');
const filesRouter = require('./files');
const editorRouter = require('./editor');
const searchRouter = require('./search');
const auth = require('../middleware/auth');
const { authFailLimiter } = require('../middleware/rateLimits');

const router = express.Router();

// Repo directory names: must start with an alphanumeric and contain only
// safe filename characters. Blocks dot-dirs (.git), shell metacharacters
// in names that later reach child processes, and traversal sequences.
const REPO_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

function isValidRepoName(name) {
  return typeof name === 'string' && REPO_NAME_RE.test(name);
}

/**
 * Validate that :repoName is a safe directory name that resolves to a
 * path inside config.docsDir. Prevents path traversal via crafted repo
 * names like "../../etc" and rejects names with shell metacharacters.
 */
function validateRepo(req, res, next) {
  const repoName = req.params.repoName;
  if (!repoName) return next();

  if (!isValidRepoName(repoName)) {
    return res.status(403).json({ error: 'Invalid repository name' });
  }

  const repoPath = path.resolve(path.join(config.docsDir, repoName));
  const docsResolved = path.resolve(config.docsDir);
  if (!repoPath.startsWith(docsResolved + path.sep)) {
    return res.status(403).json({ error: 'Invalid repository name' });
  }

  next();
}

// Apply repo name validation to all :repoName routes
router.use('/repos/:repoName', validateRepo);

// Public routes: list repos, file tree, read files, navigation, images
router.use('/repos', filesRouter);

// Search routes (public)
router.use('/repos', searchRouter);

// Editor routes (require authentication; failed logins are rate-limited)
router.use('/repos', authFailLimiter, auth, editorRouter);

module.exports = router;
module.exports.isValidRepoName = isValidRepoName;
