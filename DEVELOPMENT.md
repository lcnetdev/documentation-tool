# Development Guide

## How the System Works

### Write Queue (`server/src/services/writeQueue.js`)

The write queue prevents concurrent file write conflicts. When multiple users save files simultaneously, edits are serialized per-repo using a promise chain:

```
User A saves title.md ──┐
                        ├──> Queue: [A writes] → [B writes] → [C writes]
User B saves about.md ──┘
User C saves title.md ──┘
```

Each enqueued operation receives a function that runs only after the previous one completes. Errors in one operation don't block subsequent ones. Different repos have independent queues so edits to separate documentation repos can happen in parallel.

### Search Index (`server/src/services/search.js`)

On startup, the server reads all `.md` files in each repo and builds an in-memory index. The index stores:
- File path
- Title (first H1 heading)
- Full text content
- Individual lines (for line-number matching)

Search is case-insensitive substring matching. Results include file path, matching line numbers, and 1 line of surrounding context. The index is refreshed after each successful git commit via the write queue.

For ~65 files this is sub-millisecond. If repos grow significantly, consider adding lunr.js for full-text indexing.

### Image Handling

**Drag-and-drop from OS**: Image files dropped onto the editor are uploaded via multipart POST to `/api/repos/:repo/images/upload`. The server saves the file to the repo's `images/` directory and returns the path. The client computes the relative path from the current file and inserts a markdown image link.

**Clipboard paste**: When pasting image data (e.g., from a screenshot), the client reads the clipboard as a Blob, converts to base64, and POSTs to `/api/repos/:repo/images/paste`. The server decodes and saves as PNG.

**File naming**: Uploaded images get names like `upload_20260213_143022_001.png` (timestamp + counter).

### Link and Image Rewriting (`client/src/composables/useMarkdown.js`)

This is the most critical frontend logic. The markdown-it instance has custom renderer rules:

**Image rewriting**: When rendering `![alt](../images/foo.png)` from file `work-description/title.md`:
1. Get current file's directory: `work-description/`
2. Resolve relative path `../images/foo.png` against it: `images/foo.png`
3. Convert to API URL: `/api/repos/documentation-marva-manual/images/foo.png`

**Link rewriting**: When rendering `[Back](../index.md)` from file `work-description/title.md`:
1. Resolve `../index.md` against `work-description/`: `index.md`
2. Convert to Vue router path: `/view/documentation-marva-manual/index.md`
3. In editor mode, links go to `/edit/...` instead

### Git Operations (`server/src/services/git.js`)

Uses `simple-git` for all git operations. Key behaviors:
- **Auto-clone**: On startup, clones the default repo if missing from `docs/`
- **Authenticated push**: Injects `GIT_TOKEN` into the remote URL
- **Author attribution**: Each commit uses `--author "username <username@documentation-tool>"`
- **Conflict handling**: If push fails (someone else pushed), does `git pull --rebase` then retries

### Authentication (`server/src/middleware/auth.js`)

HTTP Basic Auth with a twist:
- **Any username** is accepted (used as the git commit author name)
- **Password** must match the `EDITOR_PASSWORD` environment variable
- Credentials are stored in browser `sessionStorage` (cleared on tab close)

## Frontend Architecture

All Vue components use the **Options API** structure:

```javascript
export default {
  name: 'ComponentName',
  props: { ... },
  data() { return { ... } },
  computed: { ... },
  watch: { ... },
  methods: { ... },
  mounted() { ... }
}
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| ViewerLayout | `views/` | Two-column viewer with nav + content |
| EditorLayout | `views/` | Three-column editor with login gate |
| NavSidebar | `components/viewer/` | Collapsible file tree for navigation |
| MarkdownRenderer | `components/viewer/` | Renders markdown with link/image rewriting |
| SearchOverlay | `components/viewer/` | Ctrl-F cross-file search modal |
| FileTree | `components/editor/` | Draggable file tree for editor |
| MarkdownEditor | `components/editor/` | Textarea with toolbar integration |
| EditorToolbar | `components/editor/` | Markdown formatting buttons |
| SaveBar | `components/editor/` | Commit message + save button |
| ImageDropZone | `components/editor/` | Drag-and-drop image upload wrapper |

## Backend Architecture

### Route Mounting

```
/api
  /repos                    (files.js - public)
    GET /                   List repos
    GET /:repo/tree         File tree
    GET /:repo/file/*       Read file
    GET /:repo/nav          Navigation
    GET /:repo/images/*     Serve images
  /repos                    (search.js - public)
    GET /:repo/search       Search
  /repos                    (editor.js - auth required)
    POST /:repo/file/*      Save file
    DELETE /:repo/file/*    Delete file
    POST /:repo/images/*    Upload/paste images
    GET /:repo/git/status   Git status
    GET /:repo/git/log      Git log
    POST /:repo/git/pull    Git pull
```

Express routes are matched by both path AND method, so the public GET and protected POST routes on the same path coexist correctly.

## Docker Development

The Docker setup uses **volume mounts** so code changes are reflected immediately without rebuilding:

- `./server` -> `/app/server` (server source, hot-reloaded by nodemon)
- `./client` -> `/app/client` (client source, hot-reloaded by Vite)
- `./docs` -> `/app/docs` (documentation repos persist on host)
- Named volumes for `node_modules` (prevents host/container conflicts)

In **development mode**: Vite dev server runs on port 5173, Express on port 3000.
In **production mode**: Client is built, Express serves it as static files on port 3000.
