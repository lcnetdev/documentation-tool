const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { getTree, readFile, parseNav } = require('../services/fileTree');
const { getStatus } = require('../services/pdfGenerator');

const router = express.Router();

/**
 * GET /repos
 * List all repos (directories in docs/).
 */
router.get('/', (req, res) => {
  try {
    if (!fs.existsSync(config.docsDir)) {
      return res.json([]);
    }

    const entries = fs.readdirSync(config.docsDir, { withFileTypes: true });
    const repos = entries
      .filter((e) => e.isDirectory() && e.name !== '.git')
      .map((e) => e.name);

    res.json(repos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list repos', details: err.message });
  }
});

/**
 * GET /repos/:repoName/tree
 * Return the full file tree for a repo.
 */
router.get('/:repoName/tree', (req, res) => {
  try {
    const repoPath = path.join(config.docsDir, req.params.repoName);

    if (!fs.existsSync(repoPath)) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const tree = getTree(repoPath);
    res.json(tree);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read file tree', details: err.message });
  }
});

/**
 * GET /repos/:repoName/file/*
 * Read and return a markdown file's content.
 */
router.get('/:repoName/file/*', (req, res) => {
  try {
    const repoPath = path.join(config.docsDir, req.params.repoName);
    const filePath = req.params[0];

    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const content = readFile(repoPath, filePath);
    res.json({ content, path: filePath });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    res.status(500).json({ error: 'Failed to read file', details: err.message });
  }
});

/**
 * GET /repos/:repoName/nav
 * Parse index.md and return structured navigation.
 */
router.get('/:repoName/nav', (req, res) => {
  try {
    const repoPath = path.join(config.docsDir, req.params.repoName);

    if (!fs.existsSync(repoPath)) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const nav = parseNav(repoPath);
    res.json(nav);
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse navigation', details: err.message });
  }
});

/**
 * GET /repos/:repoName/images/*
 * Serve image files from the repo's directory (handles any path, not just images/ subfolder).
 */
router.get('/:repoName/images/*', (req, res) => {
  try {
    const repoPath = path.join(config.docsDir, req.params.repoName);
    const imagePath = req.params[0];

    if (!imagePath) {
      return res.status(400).json({ error: 'Image path is required' });
    }

    const fullPath = path.join(repoPath, 'images', imagePath);

    // Prevent path traversal
    const resolved = path.resolve(fullPath);
    const repoResolved = path.resolve(repoPath);
    if (!resolved.startsWith(repoResolved + path.sep)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.sendFile(resolved);
  } catch (err) {
    res.status(500).json({ error: 'Failed to serve image', details: err.message });
  }
});

/**
 * GET /repos/:repoName/pdf/status
 * Returns the current PDF build status: idle, building, ready, or error.
 */
router.get('/:repoName/pdf/status', (req, res) => {
  const status = getStatus(req.params.repoName);
  res.json(status);
});

/**
 * GET /repos/:repoName/pdf/download
 * Download the pre-built PDF. Returns 404 if not yet ready.
 */
router.get('/:repoName/pdf/download', (req, res) => {
  try {
    const status = getStatus(req.params.repoName);

    if (status.status !== 'ready' || !status.pdfPath) {
      return res.status(404).json({ error: 'PDF not ready' });
    }

    if (!fs.existsSync(status.pdfPath)) {
      return res.status(404).json({ error: 'PDF file not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="' + req.params.repoName + '.pdf"'
    );
    res.sendFile(status.pdfPath);
  } catch (err) {
    res.status(500).json({ error: 'Failed to serve PDF', details: err.message });
  }
});

module.exports = router;
