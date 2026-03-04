const fs = require('fs');
const path = require('path');

/**
 * Extract the first markdown heading (# Title) from a file.
 * Returns null if no heading is found.
 */
function extractTitle(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/^#{1,3}\s+(.+)$/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

/**
 * Format a filename as a display title:
 * remove .md extension, replace hyphens/underscores with spaces, title case.
 */
function formatFilename(name) {
  const base = name.replace(/\.md$/i, '');
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Recursively walk a directory and return a tree structure.
 * Excludes .git directory. Only includes .md files and directories
 * that contain .md files (directly or nested).
 * Sorted: directories first, then files, alphabetically within each group.
 * Each item includes a `title` field (first # heading or formatted filename).
 * Directories include `indexFile` if they contain an index.md.
 */
function getTree(repoPath, relativePath = '') {
  const fullPath = relativePath
    ? path.join(repoPath, relativePath)
    : repoPath;

  let entries;
  try {
    entries = fs.readdirSync(fullPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const result = [];

  for (const entry of entries) {
    if (entry.name === '.git') continue;

    const entryRelativePath = relativePath
      ? path.join(relativePath, entry.name)
      : entry.name;

    if (entry.isDirectory()) {
      const children = getTree(repoPath, entryRelativePath);

      // Show directory if it has .md files (nested) OR is empty (only .gitkeep)
      const dirPath = path.join(fullPath, entry.name);
      const dirEntries = fs.readdirSync(dirPath).filter(f => f !== '.git');
      const isGitkeepOnly = dirEntries.length === 0 || (dirEntries.length === 1 && dirEntries[0] === '.gitkeep');
      if (children.length === 0 && !isGitkeepOnly) continue;

      const dirItem = {
        name: entry.name,
        path: entryRelativePath,
        type: 'directory',
        title: formatFilename(entry.name),
        children,
      };

      // Check if directory has an index.md
      const indexPath = path.join(fullPath, entry.name, 'index.md');
      if (fs.existsSync(indexPath)) {
        dirItem.indexFile = entryRelativePath + '/index.md';
        const indexTitle = extractTitle(indexPath);
        if (indexTitle) {
          dirItem.title = indexTitle;
        }
      }

      result.push(dirItem);
    } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name.toLowerCase() !== 'readme.md') {
      const absPath = path.join(fullPath, entry.name);
      const title = extractTitle(absPath) || formatFilename(entry.name);
      result.push({
        name: entry.name,
        path: entryRelativePath,
        type: 'file',
        title,
      });
    }
  }

  // Sort: directories first, then files, alphabetically within each group
  result.sort((a, b) => {
    if (a.type === 'directory' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });

  // At root level, apply NAV_ORDER from index.md if present
  if (!relativePath) {
    const navOrder = parseNavOrder(repoPath);
    if (navOrder.length > 0) {
      result.sort((a, b) => {
        const aIdx = navOrder.indexOf(a.name);
        const bIdx = navOrder.indexOf(b.name);
        // Items not in list go to the end, keeping their relative alpha order
        if (aIdx === -1 && bIdx === -1) return 0;
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });
    }
  }

  return result;
}

/**
 * Read and return the content of a file.
 */
function readFile(repoPath, filePath) {
  const fullPath = path.join(repoPath, filePath);

  // Prevent path traversal
  const resolved = path.resolve(fullPath);
  const repoResolved = path.resolve(repoPath);
  if (!resolved.startsWith(repoResolved + path.sep) && resolved !== repoResolved) {
    throw new Error('Path traversal not allowed');
  }

  return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * Parse index.md to extract navigation links.
 * Looks for markdown links in the format: [Title](path)
 * Supports nested lists (indented items become children).
 * Returns structured navigation array.
 */
function parseNav(repoPath) {
  const indexPath = path.join(repoPath, 'index.md');

  if (!fs.existsSync(indexPath)) {
    return [];
  }

  const content = fs.readFileSync(indexPath, 'utf-8');
  const lines = content.split('\n');
  const nav = [];
  const linkRegex = /^(\s*)[*-]\s*\[([^\]]+)\]\(([^)]+)\)/;

  // Stack to track nesting: [{ indent, item }]
  const stack = [];

  for (const line of lines) {
    const match = line.match(linkRegex);
    if (!match) continue;

    const indent = match[1].length;
    const title = match[2];
    const linkPath = match[3];

    const item = { title, path: linkPath };

    // Find the correct parent based on indentation
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    if (stack.length === 0) {
      nav.push(item);
    } else {
      const parent = stack[stack.length - 1].item;
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(item);
    }

    stack.push({ indent, item });
  }

  return nav;
}

/**
 * Parse the NAV_ORDER comment block from the root index.md.
 * Returns an array of filenames/dirnames in display order, or empty array if none.
 */
function parseNavOrder(repoPath) {
  const indexPath = path.join(repoPath, 'index.md');
  if (!fs.existsSync(indexPath)) return [];

  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    const match = content.match(/<!--\s*\nNAV_ORDER\n([\s\S]*?)-->/);
    if (!match) return [];
    return match[1].trim().split('\n').map(l => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Update (or create) the NAV_ORDER comment block at the end of root index.md.
 * @param {string} repoPath
 * @param {string[]} order - array of filenames/dirnames
 */
function updateNavOrder(repoPath, order) {
  const indexPath = path.join(repoPath, 'index.md');
  if (!fs.existsSync(indexPath)) {
    throw new Error('index.md not found');
  }

  let content = fs.readFileSync(indexPath, 'utf-8');
  const block = '<!--\nNAV_ORDER\n' + order.join('\n') + '\n-->';

  // Replace existing block or append
  const existing = content.match(/<!--\s*\nNAV_ORDER\n[\s\S]*?-->/);
  if (existing) {
    content = content.replace(/<!--\s*\nNAV_ORDER\n[\s\S]*?-->/, block);
  } else {
    content = content.trimEnd() + '\n\n' + block + '\n';
  }

  fs.writeFileSync(indexPath, content, 'utf-8');
}

module.exports = { getTree, readFile, parseNav, parseNavOrder, updateNavOrder };
