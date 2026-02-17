const express = require('express');
const path = require('path');
const config = require('../config');
const SearchService = require('../services/search');

const router = express.Router();
const searchService = new SearchService();

/**
 * GET /repos/:repoName/search?q=term
 * Search across all markdown files in the repo.
 */
router.get('/:repoName/search', (req, res) => {
  try {
    const { repoName } = req.params;
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const repoPath = path.join(config.docsDir, repoName);

    // Build/refresh index if not already indexed
    if (!searchService.index.has(repoName)) {
      searchService.buildIndex(repoName, repoPath);
    }

    const results = searchService.search(repoName, q);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
});

module.exports = router;
