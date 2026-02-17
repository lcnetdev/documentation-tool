const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const config = require('../config');
const GitService = require('../services/git');
const WriteQueue = require('../services/writeQueue');
const { saveUploadedImage, savePastedImage } = require('../services/imageHandler');
const { invalidateCache } = require('../services/pdfGenerator');

const router = express.Router();
const writeQueue = new WriteQueue();

// Configure multer for file uploads (temp directory)
const upload = multer({ dest: path.join(__dirname, '../../uploads') });

/**
 * POST /repos/:repoName/file/*
 * Save a file, commit, and push.
 * Body: { content, commitMessage }
 */
router.post('/:repoName/file/*', (req, res) => {
  const repoName = req.params.repoName;
  const filePath = req.params[0];
  const { content, commitMessage } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: 'File path is required' });
  }

  if (content === undefined || content === null) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const repoPath = path.join(config.docsDir, repoName);
  const fullFilePath = path.join(repoPath, filePath);

  // Prevent path traversal
  const resolved = path.resolve(fullFilePath);
  const repoResolved = path.resolve(repoPath);
  if (!resolved.startsWith(repoResolved + path.sep) && resolved !== repoResolved) {
    return res.status(403).json({ error: 'Access denied' });
  }

  writeQueue
    .enqueue(repoName, async () => {
      // Ensure directory exists
      const dir = path.dirname(fullFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write file
      fs.writeFileSync(fullFilePath, content, 'utf-8');

      // Git operations
      const gitService = new GitService(repoPath);
      const message = commitMessage || `Update ${filePath}`;
      const hash = await gitService.commitAndPush(filePath, message, req.user.username);

      return hash;
    })
    .then((hash) => {
      invalidateCache(repoName, repoPath);
      res.json({ success: true, commit: hash });
    })
    .catch((err) => {
      res.status(500).json({ error: 'Failed to save file', details: err.message });
    });
});

/**
 * DELETE /repos/:repoName/file/*
 * Delete a file, commit, and push.
 */
router.delete('/:repoName/file/*', (req, res) => {
  const repoName = req.params.repoName;
  const filePath = req.params[0];

  if (!filePath) {
    return res.status(400).json({ error: 'File path is required' });
  }

  const repoPath = path.join(config.docsDir, repoName);
  const fullFilePath = path.join(repoPath, filePath);

  // Prevent path traversal
  const resolved = path.resolve(fullFilePath);
  const repoResolved = path.resolve(repoPath);
  if (!resolved.startsWith(repoResolved + path.sep)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  writeQueue
    .enqueue(repoName, async () => {
      if (!fs.existsSync(fullFilePath)) {
        throw new Error('File not found');
      }

      fs.unlinkSync(fullFilePath);

      const gitService = new GitService(repoPath);
      const message = `Delete ${filePath}`;
      const hash = await gitService.commitAndPush(filePath, message, req.user.username);

      return hash;
    })
    .then((hash) => {
      invalidateCache(repoName, repoPath);
      res.json({ success: true, commit: hash });
    })
    .catch((err) => {
      if (err.message === 'File not found') {
        return res.status(404).json({ error: 'File not found' });
      }
      res.status(500).json({ error: 'Failed to delete file', details: err.message });
    });
});

/**
 * POST /repos/:repoName/images/upload
 * Upload an image file via multipart form data.
 */
router.post('/:repoName/images/upload', upload.single('image'), (req, res) => {
  try {
    const repoName = req.params.repoName;
    const repoPath = path.join(config.docsDir, repoName);

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const relativePath = saveUploadedImage(repoPath, req.file);
    res.json({ path: relativePath });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload image', details: err.message });
  }
});

/**
 * POST /repos/:repoName/images/paste
 * Save a base64-encoded pasted image.
 * Body: { imageData, filename? }
 */
router.post('/:repoName/images/paste', (req, res) => {
  try {
    const repoName = req.params.repoName;
    const repoPath = path.join(config.docsDir, repoName);
    const { imageData, filename } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'imageData is required' });
    }

    const relativePath = savePastedImage(repoPath, imageData, filename);
    res.json({ path: relativePath });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save pasted image', details: err.message });
  }
});

/**
 * GET /repos/:repoName/git/status
 * Return git status for the repo.
 */
router.get('/:repoName/git/status', async (req, res) => {
  try {
    const repoPath = path.join(config.docsDir, req.params.repoName);
    const gitService = new GitService(repoPath);
    const status = await gitService.status();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get git status', details: err.message });
  }
});

/**
 * GET /repos/:repoName/git/log
 * Return recent 20 commits.
 */
router.get('/:repoName/git/log', async (req, res) => {
  try {
    const repoPath = path.join(config.docsDir, req.params.repoName);
    const gitService = new GitService(repoPath);
    const log = await gitService.log(20);
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get git log', details: err.message });
  }
});

/**
 * POST /repos/:repoName/git/pull
 * Pull latest changes from remote.
 */
router.post('/:repoName/git/pull', async (req, res) => {
  try {
    const repoPath = path.join(config.docsDir, req.params.repoName);
    const gitService = new GitService(repoPath);
    const result = await gitService.pull();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to pull', details: err.message });
  }
});

/**
 * POST /repos/:repoName/create
 * Create a new file or directory.
 * Body: { path, type: "file" | "directory" }
 */
router.post('/:repoName/create', (req, res) => {
  const repoName = req.params.repoName;
  const { path: itemPath, type } = req.body;

  if (!itemPath || !type) {
    return res.status(400).json({ error: 'path and type are required' });
  }

  if (type !== 'file' && type !== 'directory') {
    return res.status(400).json({ error: 'type must be "file" or "directory"' });
  }

  // Reject paths with traversal attempts
  if (itemPath.includes('..')) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  // Enforce .md extension for files
  if (type === 'file' && !itemPath.endsWith('.md')) {
    return res.status(400).json({ error: 'File must have .md extension' });
  }

  const repoPath = path.join(config.docsDir, repoName);
  const fullPath = path.join(repoPath, itemPath);

  // Prevent path traversal
  const resolved = path.resolve(fullPath);
  const repoResolved = path.resolve(repoPath);
  if (!resolved.startsWith(repoResolved + path.sep) && resolved !== repoResolved) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (type === 'file') {
    if (fs.existsSync(fullPath)) {
      return res.status(409).json({ error: 'File already exists' });
    }

    writeQueue
      .enqueue(repoName, async () => {
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(fullPath, '', 'utf-8');

        const gitService = new GitService(repoPath);
        const message = `Create ${itemPath}`;
        const hash = await gitService.commitAndPush(itemPath, message, req.user.username);
        return hash;
      })
      .then((hash) => {
        invalidateCache(repoName, repoPath);
        res.json({ success: true, path: itemPath, commit: hash });
      })
      .catch((err) => {
        res.status(500).json({ error: 'Failed to create file', details: err.message });
      });
  } else {
    // directory
    if (fs.existsSync(fullPath)) {
      return res.status(409).json({ error: 'Directory already exists' });
    }

    writeQueue
      .enqueue(repoName, async () => {
        fs.mkdirSync(fullPath, { recursive: true });

        // Add .gitkeep so the directory persists in git
        const gitkeepPath = path.join(fullPath, '.gitkeep');
        fs.writeFileSync(gitkeepPath, '', 'utf-8');

        const gitService = new GitService(repoPath);
        const gitkeepRelative = path.join(itemPath, '.gitkeep');
        const message = `Create directory ${itemPath}`;
        const hash = await gitService.commitAndPush(gitkeepRelative, message, req.user.username);
        return hash;
      })
      .then((hash) => {
        res.json({ success: true, path: itemPath, commit: hash });
      })
      .catch((err) => {
        res.status(500).json({ error: 'Failed to create directory', details: err.message });
      });
  }
});

module.exports = router;
