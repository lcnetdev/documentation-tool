const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { getTree, readFile, parseNav } = require('../services/fileTree');
const { processIncludes, prependGlobalStyle } = require('../services/includeProcessor');
const { getStatus, buildSinglePagePdf } = require('../services/pdfGenerator');
const MarkdownIt = require('markdown-it');
const RepoMeta = require('../services/repoMeta');

const router = express.Router();
const repoMeta = new RepoMeta();

/**
 * GET /repos
 * List all repos with metadata (type, branches).
 */
router.get('/', (req, res) => {
  try {
    const all = repoMeta.listAll();

    // Enrich original repos with their branches list
    const result = all.map(repo => {
      if (repo.type === 'original') {
        return { ...repo, branches: repoMeta.getBranches(repo.name) };
      }
      return repo;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list repos', details: err.message });
  }
});

/**
 * GET /repos/:repoName/info
 * Return metadata for a single repo.
 */
router.get('/:repoName/info', (req, res) => {
  try {
    const repoName = req.params.repoName;
    const repoPath = path.join(config.docsDir, repoName);

    if (!fs.existsSync(repoPath)) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const info = repoMeta.get(repoName) || { type: 'original' };
    const result = { name: repoName, ...info };

    if (result.type === 'original') {
      result.branches = repoMeta.getBranches(repoName);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get repo info', details: err.message });
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

    const rawContent = readFile(repoPath, filePath);
    const content = req.query.raw !== undefined
      ? rawContent
      : prependGlobalStyle(processIncludes(rawContent, repoPath, filePath), repoPath);
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

/**
 * GET /repos/:repoName/pdf/page/*
 * Generate and download a PDF for a single page.
 */
router.get('/:repoName/pdf/page/*', async (req, res) => {
  try {
    const repoPath = path.join(config.docsDir, req.params.repoName);
    const filePath = req.params[0];

    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const fullPath = path.join(repoPath, filePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const pdfBuffer = await buildSinglePagePdf(repoPath, filePath);
    const filename = filePath.replace(/\//g, '-').replace(/\.md$/, '') + '.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate page PDF', details: err.message });
  }
});

/**
 * GET /repos/:repoName/html/page/*
 * Generate and download a self-contained HTML file for a single page.
 * Images are base64-encoded inline.
 */
router.get('/:repoName/html/page/*', (req, res) => {
  try {
    const repoName = req.params.repoName;
    const repoPath = path.join(config.docsDir, repoName);
    const filePath = req.params[0];

    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const rawContent = readFile(repoPath, filePath);
    const content = prependGlobalStyle(processIncludes(rawContent, repoPath, filePath), repoPath);

    const md = new MarkdownIt({ html: true, linkify: true, breaks: true });
    let html = md.render(content);

    // Base64-encode all local images
    html = html.replace(/<img\s+([^>]*?)src="([^"]+)"([^>]*?)>/g, (match, before, src, after) => {
      // Skip external URLs
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
        return match;
      }

      // Resolve the image path relative to the file's directory
      let imagePath;
      if (src.startsWith('/api/repos/')) {
        // Already an API path like /api/repos/name/images/foo.png
        const imgFile = src.replace(/^\/api\/repos\/[^/]+\/images\//, '');
        imagePath = path.join(repoPath, 'images', imgFile);
      } else {
        const fileDir = path.dirname(filePath);
        imagePath = path.join(repoPath, fileDir, src);
      }

      const resolved = path.resolve(imagePath);
      if (!resolved.startsWith(path.resolve(repoPath))) {
        return match; // path traversal, skip
      }

      if (!fs.existsSync(resolved)) {
        return match; // file not found, leave as-is
      }

      try {
        const data = fs.readFileSync(resolved);
        const ext = path.extname(resolved).toLowerCase();
        const mimeTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
        const mime = mimeTypes[ext] || 'application/octet-stream';
        const b64 = data.toString('base64');
        return '<img ' + before + 'src="data:' + mime + ';base64,' + b64 + '"' + after + '>';
      } catch {
        return match;
      }
    });

    // Extract title from first heading
    const titleMatch = rawContent.match(/^#{1,3}\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : filePath;

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #1a202c; max-width: 900px; margin: 0 auto; padding: 24px 48px; }
  h1 { font-size: 2em; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.25em; }
  h3 { font-size: 1.25em; }
  code { font-family: 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.875em; background: #f1f5f9; padding: 2px 6px; border-radius: 3px; color: #e53e3e; }
  pre { background: #1e293b; color: #e2e8f0; padding: 16px; border-radius: 6px; overflow-x: auto; }
  pre code { background: none; padding: 0; color: inherit; }
  blockquote { margin: 1em 0; padding: 0.5em 1em; border-left: 4px solid #4a90d9; background: #ebf8ff; color: #2c5282; }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; }
  th { background: #f7fafc; border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; font-weight: 600; }
  td { border: 1px solid #e2e8f0; padding: 8px 12px; vertical-align: top; }
  tr:nth-child(even) { background: #f7fafc; }
  img { max-width: 100%; height: auto; border-radius: 6px; }
  figure { margin: 1em 0; text-align: center; }
  figcaption { font-size: 0.9em; color: #718096; margin-top: 0.5em; }
  a { color: #4a90d9; text-decoration: none; }
  a:hover { text-decoration: underline; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 2em 0; }
  ul, ol { padding-left: 2em; }
  li { margin: 0.25em 0; }
</style>
</head>
<body>
${html}
</body>
</html>`;

    const filename = filePath.replace(/\//g, '-').replace(/\.md$/, '') + '.html';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.send(fullHtml);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    res.status(500).json({ error: 'Failed to generate HTML', details: err.message });
  }
});

module.exports = router;
