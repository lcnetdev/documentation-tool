const fs = require('fs');
const path = require('path');

class SearchService {
  constructor() {
    this.index = new Map();
  }

  /**
   * Recursively find all .md files in a directory.
   */
  _findMarkdownFiles(dirPath, relativePath = '') {
    const files = [];
    let entries;

    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return files;
    }

    for (const entry of entries) {
      if (entry.name === '.git') continue;

      const fullPath = path.join(dirPath, entry.name);
      const relPath = relativePath
        ? path.join(relativePath, entry.name)
        : entry.name;

      if (entry.isDirectory()) {
        files.push(...this._findMarkdownFiles(fullPath, relPath));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push({ fullPath, relativePath: relPath });
      }
    }

    return files;
  }

  /**
   * Build the search index for a given repo.
   * Reads all .md files and stores their content, title, and lines.
   */
  buildIndex(repoName, repoPath) {
    const mdFiles = this._findMarkdownFiles(repoPath);
    const entries = [];

    for (const { fullPath, relativePath } of mdFiles) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');

        // Extract first H1 as title
        let title = path.basename(relativePath, '.md');
        for (const line of lines) {
          const h1Match = line.match(/^#\s+(.+)/);
          if (h1Match) {
            title = h1Match[1].trim();
            break;
          }
        }

        entries.push({
          filePath: relativePath,
          title,
          content,
          lines,
        });
      } catch {
        // Skip files that can't be read
      }
    }

    this.index.set(repoName, entries);
  }

  /**
   * Strip markdown syntax from a line to produce plain text for display.
   */
  _stripMarkdown(text) {
    return text
      // Remove heading markers
      .replace(/^#{1,6}\s+/, '')
      // Remove image syntax ![alt](url)
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Remove link syntax [text](url) -> text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Remove bold/italic markers
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
      .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
      // Remove strikethrough
      .replace(/~~([^~]+)~~/g, '$1')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove list markers
      .replace(/^\s*[*\-+]\s+/, '')
      .replace(/^\s*\d+\.\s+/, '')
      // Remove blockquote markers
      .replace(/^\s*>\s?/, '')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/, '')
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      .trim();
  }

  /**
   * Search across all indexed files for a repo.
   * Case-insensitive search.
   * Returns matching files with line numbers and context.
   */
  search(repoName, query) {
    const entries = this.index.get(repoName);

    if (!entries || !query) {
      return { query, results: [], totalMatches: 0 };
    }

    const lowerQuery = query.toLowerCase();
    const results = [];
    let totalMatches = 0;

    for (const entry of entries) {
      const matches = [];

      for (let i = 0; i < entry.lines.length; i++) {
        if (entry.lines[i].toLowerCase().includes(lowerQuery)) {
          // Gather surrounding context lines
          const contextStart = Math.max(0, i - 1);
          const contextEnd = Math.min(entry.lines.length - 1, i + 1);
          const context = entry.lines.slice(contextStart, contextEnd + 1).join('\n');

          matches.push({
            line: i + 1,
            text: this._stripMarkdown(entry.lines[i]),
            context,
          });
        }
      }

      if (matches.length > 0) {
        totalMatches += matches.length;
        results.push({
          file: entry.filePath,
          title: entry.title,
          matches,
        });
      }
    }

    return { query, results, totalMatches };
  }

  /**
   * Rebuild the index for a repo.
   */
  refreshIndex(repoName, repoPath) {
    this.buildIndex(repoName, repoPath);
  }
}

module.exports = SearchService;
