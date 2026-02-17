# Documentation Tool

A web-based documentation viewer and editor for Markdown-based manuals stored as git repositories.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Docker Container                   │
│                                                     │
│  ┌──────────────┐          ┌──────────────────────┐ │
│  │  Vite Dev     │  proxy   │  Express Server      │ │
│  │  (port 5173)  │ ──────> │  (port 3000)         │ │
│  │  Vue 3 SPA    │  /api   │                      │ │
│  └──────────────┘          │  ├─ File API         │ │
│                            │  ├─ Search API       │ │
│                            │  ├─ Editor API       │ │
│                            │  ├─ Git Service      │ │
│                            │  └─ Write Queue      │ │
│                            └──────────┬───────────┘ │
│                                       │             │
│                            ┌──────────▼───────────┐ │
│                            │  /docs/              │ │
│                            │  └─ marva-manual/    │ │
│                            │     (git repo)       │ │
│                            └──────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Frontend**: Vite + Vue 3 (Options API)
**Backend**: Node.js + Express
**Git**: simple-git for programmatic git operations
**Infrastructure**: Docker Compose with volume mounts for live development

## Quick Start

### With Docker (recommended)

```bash
# Clone and configure
cp .env.example .env
# Edit .env with your GitHub credentials and editor password

# Start
docker compose up

# Access:
#   Viewer: http://localhost:5173
#   Editor: http://localhost:5173/edit/documentation-marva-manual/index.md
```

### Local Development

```bash
# Install dependencies
cd server && npm install
cd ../client && npm install

# Configure
cp .env.example .env

# Start server (in one terminal)
cd server && npm run dev

# Start client (in another terminal)
cd client && npm run dev

# Access at http://localhost:5173
```

## Configuration (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `EDITOR_PASSWORD` | Shared password for editor access | `changeme` |
| `GIT_USER` | GitHub username for push authentication | |
| `GIT_TOKEN` | GitHub personal access token | |
| `NODE_ENV` | `development` or `production` | `development` |
| `PORT` | Server port | `3000` |

## Features

### Viewer (`/view/:repoName/:filePath`)
- Two-column layout: navigation sidebar + rendered markdown
- Cross-file search (Ctrl-F / Cmd-F) that searches all markdown files
- Images rendered with macOS-style subtle drop shadows
- Relative links between documents work seamlessly

### Editor (`/edit/:repoName/:filePath`)
- Protected by HTTP basic auth (any username, shared password)
- Three-column layout: file tree | markdown editor | live preview
- Markdown toolbar (headings, bold, italic, links, lists, code, etc.)
- Drag files from tree to editor to auto-insert relative links
- Drag-and-drop images into editor (saves to /images/, inserts link)
- Clipboard paste images (converts to PNG, saves, inserts link)
- Save with commit message (each save = git commit under your name)
- Write queue serializes concurrent saves to prevent conflicts

## API Reference

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/repos` | List available documentation repos |
| GET | `/api/repos/:repo/tree` | Get file tree |
| GET | `/api/repos/:repo/file/*path` | Read a markdown file |
| GET | `/api/repos/:repo/images/*path` | Serve an image |
| GET | `/api/repos/:repo/search?q=term` | Search across all files |
| GET | `/api/repos/:repo/nav` | Get navigation structure |

### Protected Endpoints (require basic auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/repos/:repo/file/*path` | Save file + git commit |
| DELETE | `/api/repos/:repo/file/*path` | Delete file |
| POST | `/api/repos/:repo/images/upload` | Upload image (multipart) |
| POST | `/api/repos/:repo/images/paste` | Save clipboard image (base64) |
| GET | `/api/repos/:repo/git/status` | Git status |
| GET | `/api/repos/:repo/git/log` | Recent commits |
| POST | `/api/repos/:repo/git/pull` | Pull from remote |

## Adding New Documentation Repos

Documentation repos are cloned into the `docs/` directory. To add a new repo:

1. Clone it into `docs/`: `git clone <url> docs/<repo-name>`
2. Access it at `/view/<repo-name>/index.md`

The first repo (`documentation-marva-manual`) is auto-cloned on startup if missing.

## Testing

```bash
# Run all tests
npm test

# Server tests only
npm run test:server

# Client tests only
npm run test:client
```

## Project Structure

```
documentation-tool/
├── docker-compose.yml       # Docker orchestration
├── Dockerfile               # Container build
├── .env.example             # Environment template
├── server/                  # Express backend
│   └── src/
│       ├── index.js         # Entry point
│       ├── config.js        # Environment config
│       ├── middleware/auth.js
│       ├── routes/          # API routes
│       └── services/        # Business logic
│           ├── git.js       # Git operations
│           ├── writeQueue.js # Concurrent write serialization
│           ├── search.js    # Full-text search index
│           ├── fileTree.js  # File tree builder
│           └── imageHandler.js
├── client/                  # Vue 3 frontend
│   └── src/
│       ├── views/           # ViewerLayout, EditorLayout
│       ├── components/      # UI components
│       ├── composables/     # useMarkdown (link/image rewriting)
│       └── utils/           # Path resolution utilities
└── docs/                    # Documentation repos (git-ignored)
```

## License

CC0 1.0 Universal
