const fs = require('fs');
const path = require('path');

/**
 * Process <include filename.md> directives in markdown content.
 *
 * Looks for lines like: <include B1.1.md>
 * Resolves the file from a "subpages" directory relative to the current file's directory.
 * Replaces the directive with the included file's content.
 *
 * @param {string} content - The markdown content to process
 * @param {string} repoPath - Absolute path to the repo root
 * @param {string} filePath - Relative path of the current file (e.g. "B1/index.md")
 * @returns {string} Content with includes resolved
 */
function processIncludes(content, repoPath, filePath) {
  const fileDir = path.dirname(filePath);
  const includeRegex = /^<include\s+([^>]+)>\s*$/gim;

  return content.replace(includeRegex, (match, includeName) => {
    includeName = includeName.trim();

    // Resolve from subpages/ directory relative to the current file
    const subpagesDir = path.join(repoPath, fileDir, 'subpages');

    // Prevent path traversal
    const resolved = path.resolve(path.join(subpagesDir, includeName));
    const repoResolved = path.resolve(repoPath);
    if (!resolved.startsWith(repoResolved + path.sep)) {
      return includeError(`INCLUDE FAILED: path not allowed for "${includeName}"`);
    }

    // Case-insensitive filename lookup
    let actualName = null;
    try {
      const files = fs.readdirSync(subpagesDir);
      actualName = files.find(f => f.toLowerCase() === includeName.toLowerCase());
    } catch {
      return includeError(`INCLUDE FAILED: subpages/ directory not found`);
    }

    if (!actualName) {
      return includeError(`INCLUDE FAILED: "${includeName}" not found in subpages/`);
    }

    const includePath = path.join(subpagesDir, actualName);

    try {
      const includeContent = fs.readFileSync(includePath, 'utf-8');
      // Recursively process includes in the included file
      const nestedFilePath = path.join(fileDir, 'subpages', actualName);
      return processIncludes(includeContent, repoPath, nestedFilePath);
    } catch (err) {
      return includeError(`INCLUDE FAILED: could not read "${includeName}"`);
    }
  });
}

function includeError(message) {
  return `<div style="color: red; font-weight: bold; padding: 8px; border: 1px solid red; border-radius: 4px; margin: 8px 0;">${message}</div>`;
}

/**
 * Prepend global-style.md content if it exists in the repo root.
 */
function prependGlobalStyle(content, repoPath) {
  const stylePath = path.join(repoPath, 'global-style.md');
  try {
    if (fs.existsSync(stylePath)) {
      const style = fs.readFileSync(stylePath, 'utf-8');
      return style + '\n\n' + content;
    }
  } catch {
    // ignore read errors
  }
  return content;
}

module.exports = { processIncludes, prependGlobalStyle };
