const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const apiRouter = require('./routes/api');
const GitService = require('./services/git');
const SearchService = require('./services/search');
const { ensurePdf } = require('./services/pdfGenerator');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const base = config.basePath; // e.g. '/docs/' or '/'

// API routes
app.use(base + 'api', apiRouter);

// Serve repo images under the base path
app.use(base + 'api/repos/:repoName/images', (req, res, next) => {
  const repoName = req.params.repoName;
  const imagesDir = path.join(config.docsDir, repoName, 'images');
  express.static(imagesDir)(req, res, next);
});

// Production: serve client/dist as static files and SPA fallback
if (config.nodeEnv === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(base, express.static(clientDist));

  // SPA fallback: serve index.html for non-API, base-prefixed routes
  app.get(base + '*', (req, res) => {
    if (!req.path.startsWith(base + 'api')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    }
  });
}

// Startup
async function start() {
  // Ensure docs/ directory exists
  if (!fs.existsSync(config.docsDir)) {
    fs.mkdirSync(config.docsDir, { recursive: true });
    console.log(`Created docs directory at ${config.docsDir}`);
  }

  // Clone default documentation repo if missing
  try {
    const gitService = new GitService(config.docsDir);
    await gitService.cloneIfMissing(
      'documentation-marva-manual',
      'https://github.com/lcnetdev/documentation-marva-manual.git'
    );

    // Build search index for the cloned repo
    const searchService = new SearchService();
    const repoPath = path.join(config.docsDir, 'documentation-marva-manual');
    if (fs.existsSync(repoPath)) {
      searchService.buildIndex('documentation-marva-manual', repoPath);
      console.log('Search index built for documentation-marva-manual');

      // Kick off background PDF generation if not already cached
      ensurePdf(repoPath, 'documentation-marva-manual');
    }
  } catch (err) {
    console.error('Failed to clone default repo:', err.message);
    console.log('Server will continue without the default repo.');
  }

  app.listen(config.port, () => {
    console.log(`Documentation server running on port ${config.port}`);
    console.log(`Base path: ${config.basePath}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Docs directory: ${config.docsDir}`);
  });
}

start();

module.exports = app;
