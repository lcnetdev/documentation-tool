const express = require('express');
const path = require('path');
const config = require('../config');
const filesRouter = require('./files');
const editorRouter = require('./editor');
const searchRouter = require('./search');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * Validate that :repoName resolves to a path inside config.docsDir.
 * Prevents path traversal via crafted repo names like "../../etc".
 */
function validateRepo(req, res, next) {
  const repoName = req.params.repoName;
  if (!repoName) return next();

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

// Editor routes (require authentication)
router.use('/repos', auth, editorRouter);

module.exports = router;
