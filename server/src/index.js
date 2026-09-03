const express = require('express');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const apiRouter = require('./routes/api');
const { isValidRepoName } = require('./routes/api');
const { apiLimiter } = require('./middleware/rateLimits');
const GitService = require('./services/git');
const SearchService = require('./services/search');
const { ensurePdf } = require('./services/pdfGenerator');
const RepoMeta = require('./services/repoMeta');

const app = express();

// Trust the first proxy hop so rate limiting sees real client IPs
// when deployed behind a reverse proxy.
app.set('trust proxy', 1);

// Middleware
// No CORS middleware: client and API share an origin (Vite proxies /api in
// dev), so cross-origin access is intentionally not granted.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // rendered docs use inline styles
        imgSrc: ["'self'", 'data:', 'https:'], // docs may embed external images
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const base = config.basePath; // e.g. '/docs/' or '/'

// API routes
app.use(base + 'api', apiLimiter, apiRouter);

// Serve repo images under the base path
app.use(base + 'api/repos/:repoName/images', (req, res, next) => {
  const repoName = req.params.repoName;
  if (!isValidRepoName(repoName)) {
    return res.status(403).json({ error: 'Invalid repository name' });
  }
  const imagesDir = path.join(config.docsDir, repoName, 'images');
  express.static(imagesDir, { dotfiles: 'deny' })(req, res, next);
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
  // Refuse to run with a missing or default editor password — the editor
  // endpoints can write to and push GitHub repositories.
  if (!process.env.EDITOR_PASSWORD || process.env.EDITOR_PASSWORD === 'changeme') {
    console.error('FATAL: EDITOR_PASSWORD is unset or still "changeme".');
    console.error('Set a strong EDITOR_PASSWORD in .env before starting the server.');
    process.exit(1);
  }

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
    }
  } catch (err) {
    console.error('Failed to clone default repo:', err.message);
    console.log('Server will continue without the default repo.');
  }

  // Seed repo metadata for any existing directories
  const repoMeta = new RepoMeta();
  repoMeta.seedExisting();
  console.log('Repo metadata seeded.');

  // Pick up the cached manual PDF, or start building one, for every repo.
  // Previously only the default repo got this, so every other repo reported
  // "idle" forever and the viewer never stopped polling for it.
  for (const repo of repoMeta.listAll()) {
    ensurePdf(path.join(config.docsDir, repo.name), repo.name);
  }

  // Scrub credentials that older versions embedded in each repo's
  // .git/config (GitService now authenticates per-invocation instead)
  for (const entry of fs.readdirSync(config.docsDir, { withFileTypes: true })) {
    if (entry.isDirectory() && fs.existsSync(path.join(config.docsDir, entry.name, '.git'))) {
      new GitService(path.join(config.docsDir, entry.name));
    }
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
