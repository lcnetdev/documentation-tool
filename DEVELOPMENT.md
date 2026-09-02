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

### Navigation Order (`NAV_ORDER`)

The tree (`server/src/services/fileTree.js`) sorts each directory as folders first, then files, alphabetically. A directory's own `index.md` can override that for its children with a hidden comment block listing file and folder **names** (not titles); unlisted entries follow in alphabetical order:

```html
<!--
NAV_ORDER
index.md
about.md
Configuration
-->
```

The repo root's `index.md` orders the top level; a subdirectory's `index.md` orders that subdirectory. In the editor, **Reorder** lets you pick a folder and drag its entries; saving posts `{ order, dir }` to `POST /repos/:repo/nav-order`, which rewrites the block in that folder's `index.md` and commits it. A folder without an `index.md` cannot be given a custom order.

Viewer and editor URLs that end in `/` (a directory, or just the repo) redirect to that directory's `index.md` (`client/src/utils/indexRedirect.js`, applied as a router guard in `client/src/router/index.js`).

### Rendering Hints (`LIST_STYLE`)

To nudge how a list is laid out, put an HTML comment on the line just above it (`client/src/utils/listStyleHints.js`; the HTML export has its own copy in `server/src/services/listStyleHints.js`):

```markdown
<!-- LIST_STYLE: compact two-column -->

- [bf:classification](https://id.loc.gov/ontologies/bibframe.html#p_classification)
- [bf:content](https://id.loc.gov/ontologies/bibframe.html#p_content)
```

The comment itself never reaches the output; every word the plugin recognizes turns into a class on the list: `compact` (tighter spacing, and bullet lists lose their markers and indent — numbered lists keep their numbers), `two-column` and `three-column` (CSS multi-column, dropping back to a single column below 700px). Unrecognized words are skipped, and a hint that doesn't sit directly above a list has no effect. The styles are in `client/src/assets/main.css` under "LIST_STYLE hint styles". To introduce a new hint word, extend `LIST_STYLE_CLASSES` in both plugin files and write the CSS in both places.

### Syntax Highlighting and RDF Code Blocks

Fenced code blocks are highlighted with [Prism](https://prismjs.com/) (`client/src/utils/highlight.js`). The markdown-it instance passes every fence through `highlightCode(code, lang)`; fence names are mapped to grammars via an alias table (`xml`/`rdfxml` -> markup, `ttl` -> turtle, `jsonld` -> json, ...). Unknown languages fall back to escaped plain text. Token colours live in `client/src/assets/main.css` ("Syntax Highlighting"); the HTML download uses the same grammars server-side (`server/src/services/highlight.js`).

**RDF/XML blocks** get a richer treatment. `looksLikeRdfXml(lang, code)` (`client/src/utils/rdf/detect.js`) flags a fence when:
- its language is `rdf`, `rdfxml`, `rdf-xml` or `rdf/xml`, or
- its language is `xml` (or empty) and the content contains `<rdf:RDF`, `<rdf:Description`, or an `rdf:about` / `rdf:resource` / `rdf:nodeID` / `rdf:ID` / `rdf:parseType` / `rdf:datatype` attribute.

For those, the fence renderer emits `<div class="rdf-block"><pre><code>...</code></pre></div>`. After each render `MarkdownRenderer` mounts an `RdfCodeBlock` Vue app into every wrapper (and unmounts the previous ones, since `v-html` replaces the DOM). The component shows tabs:

| Tab | Source |
| --- | --- |
| RDF/XML | the Prism-highlighted fence content |
| JSON-LD | `toJsonLd()` - `@context` of the prefixes actually used, embedded blank nodes, `@list`, native numbers/booleans |
| Turtle | `toTurtle()` - nested `[ ... ]` for single-use blank nodes, `( ... )` for collections, `a` for `rdf:type`, numeric/boolean shorthand |
| Graph | `RdfGraph.vue` - dagre layout; resources are ellipses, classes are tinted ellipses, blank nodes dashed, literals are boxes (with `@lang` / `^^datatype`), predicates are labeled arrows. Shown at natural size (readable labels; drag to pan), with Fit / 100% buttons, ctrl/cmd+wheel zoom, and a top-to-bottom (default) / left-to-right switch. |

Conversion happens lazily on the first tab switch; the RDF utilities (`client/src/utils/rdf/`) and dagre are loaded as a separate chunk.

The parser (`client/src/utils/rdf/rdfxml.js`) is a DOMParser-based implementation of the RDF/XML grammar (typed nodes, property attributes, `rdf:resource`, `rdf:nodeID`, `rdf:datatype`, `xml:lang`, `xml:base`, `rdf:parseType="Resource|Collection|Literal"`, `rdf:li`, reification). Because documentation examples are usually fragments, `prepareRdfXml()` first:
1. strips an XML declaration,
2. wraps the snippet in `<rdf:RDF>` when it has no such root, and
3. declares any prefix that is used but not declared, using the well-known table in `client/src/utils/rdf/terms.js` (`bf`, `bflc`, `madsrdf`, `rdfs`, `xsd`, `foaf`, `dcterms`, `schema`, ...). Unknown prefixes get a placeholder namespace and a warning is shown above the converted output.

Malformed XML is reported in the tab panel with the line and column from the browser's parser.

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
