const fs = require('fs');
const path = require('path');

/**
 * Extract the first markdown heading (# Title) from a file.
 * Returns null if no heading is found.
 */
function extractTitle(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/^#\s+(.+)$/m);
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
      // Only include directories that contain .md files (directly or nested)
      if (children.length > 0) {
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
      }
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

module.exports = { getTree, readFile, parseNav };
