const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { parseNav } = require('./fileTree');

/**
 * Per-repo state:
 *   status: 'idle' | 'building' | 'ready' | 'error'
 *   pdfPath: string | null
 *   error: string | null
 */
const repoState = new Map();

function getState(repoName) {
  if (!repoState.has(repoName)) {
    repoState.set(repoName, { status: 'idle', pdfPath: null, error: null });
  }
  return repoState.get(repoName);
}

/**
 * Get the list of markdown files in index.md link order.
 */
function getOrderedFiles(repoPath) {
  const files = [];
  const indexPath = path.join(repoPath, 'index.md');
  if (fs.existsSync(indexPath)) {
    files.push('index.md');
  }

  const nav = parseNav(repoPath);
  const seen = new Set(files);

  function walk(items) {
    for (const item of items) {
      if (item.path && item.path.endsWith('.md') && !seen.has(item.path)) {
        seen.add(item.path);
        files.push(item.path);
      }
      if (item.children) {
        walk(item.children);
      }
    }
  }

  walk(nav);
  return files;
}

// Font sizes for heading levels
const HEADING_SIZES = { 1: 22, 2: 18, 3: 15, 4: 13, 5: 12, 6: 11 };
const BODY_SIZE = 10;
const CODE_SIZE = 9;
const TABLE_SIZE = 9;
const MARGIN = 54; // 0.75 inches
const PAGE_WIDTH = 612; // Letter width in points
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const TABLE_CELL_PAD = 4;

/**
 * Strip inline markdown from text for plain-text rendering (used for headings).
 */
function stripInlineMarkdown(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')     // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')       // links
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')       // bold/italic
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')          // bold/italic
    .replace(/~~([^~]+)~~/g, '$1')                   // strikethrough
    .replace(/`([^`]+)`/g, '$1')                     // inline code
    .replace(/<[^>]+>/g, '');                         // HTML tags
}

/**
 * Parse inline markdown into segments for rich PDF rendering.
 * Returns array of { text, bold, italic, code, link, goTo, color }.
 * link = external URL, goTo = internal named destination.
 */
function parseInlineSegments(text) {
  const segments = [];
  // Regex to match inline patterns in order: images, links, bold+italic, bold, italic (*/_ variants), code, strikethrough, HTML tags
  const inlineRe = /!\[([^\]]*)\]\(([^)]*)\)|\[([^\]]*)\]\(([^)]*)\)|\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|___(.+?)___|__(.+?)__|_(.+?)_|`([^`]+)`|~~(.+?)~~|<[^>]+>/g;

  let lastIndex = 0;
  let match;
  while ((match = inlineRe.exec(text)) !== null) {
    // Add plain text before this match
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      // Image ![alt](src) — just show alt text
      if (match[1]) segments.push({ text: match[1], italic: true, color: '#718096' });
    } else if (match[3] !== undefined) {
      // Link [text](url)
      const url = match[4];
      const isExternal = url.startsWith('http://') || url.startsWith('https://');
      if (isExternal) {
        segments.push({ text: match[3], link: url, color: '#2b6cb0' });
      } else {
        // Internal .md link — store raw href for goTo resolution
        segments.push({ text: match[3], internalHref: url, color: '#2b6cb0' });
      }
    } else if (match[5] !== undefined) {
      // ***bold italic***
      segments.push({ text: match[5], bold: true, italic: true });
    } else if (match[6] !== undefined) {
      // **bold**
      segments.push({ text: match[6], bold: true });
    } else if (match[7] !== undefined) {
      // *italic*
      segments.push({ text: match[7], italic: true });
    } else if (match[8] !== undefined) {
      // ___bold italic___
      segments.push({ text: match[8], bold: true, italic: true });
    } else if (match[9] !== undefined) {
      // __bold__
      segments.push({ text: match[9], bold: true });
    } else if (match[10] !== undefined) {
      // _italic_
      segments.push({ text: match[10], italic: true });
    } else if (match[11] !== undefined) {
      // `code`
      segments.push({ text: match[11], code: true, color: '#334155' });
    } else if (match[12] !== undefined) {
      // ~~strikethrough~~ — just render as plain
      segments.push({ text: match[12] });
    }
    // HTML tags are silently stripped

    lastIndex = match.index + match[0].length;
  }

  // Add remaining plain text
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ text }];
}

/**
 * Resolve an internal .md link href relative to the current file
 * and return the matching destination name, or null if not found.
 */
function resolveInternalLink(href, currentFilePath, destinationSet) {
  if (!href || href.startsWith('http://') || href.startsWith('https://')) return null;
  // Strip any anchor fragment
  const hrefNoHash = href.split('#')[0];
  if (!hrefNoHash) return null;
  // Resolve relative to current file's directory
  const currentDir = path.dirname(currentFilePath);
  const resolved = path.normalize(path.join(currentDir, hrefNoHash));
  if (destinationSet.has(resolved)) {
    return resolved;
  }
  return null;
}

/**
 * Render rich inline text (with bold, italic, code, links) into the PDF.
 * currentFilePath + destinations enable internal .md link navigation.
 */
function renderInlineText(doc, text, x, options = {}) {
  const { width = CONTENT_WIDTH, fontSize = BODY_SIZE, lineGap = 0,
          currentFilePath = '', destinations = null } = options;
  const segments = parseInlineSegments(text);

  doc.fontSize(fontSize);
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;

    // Set font
    if (seg.code) {
      doc.font('Courier').fontSize(fontSize - 1);
    } else if (seg.bold && seg.italic) {
      doc.font('Helvetica-BoldOblique').fontSize(fontSize);
    } else if (seg.bold) {
      doc.font('Helvetica-Bold').fontSize(fontSize);
    } else if (seg.italic) {
      doc.font('Helvetica-Oblique').fontSize(fontSize);
    } else {
      doc.font('Helvetica').fontSize(fontSize);
    }

    // Set color
    doc.fillColor(seg.color || '#1a202c');

    const textOpts = { continued: !isLast, width, lineGap };
    if (seg.link) {
      // External URL
      textOpts.link = seg.link;
      textOpts.underline = true;
    } else if (seg.internalHref && destinations) {
      // Internal .md link — resolve to PDF named destination
      const dest = resolveInternalLink(seg.internalHref, currentFilePath, destinations);
      if (dest) {
        textOpts.goTo = dest;
        textOpts.underline = true;
      } else {
        textOpts.underline = false;
      }
    } else {
      textOpts.underline = false;
    }

    // On first segment, position at x
    if (i === 0) {
      doc.text(seg.text, x, undefined, textOpts);
    } else {
      doc.text(seg.text, textOpts);
    }
  }

  // Reset
  doc.font('Helvetica').fontSize(BODY_SIZE).fillColor('#1a202c');
}

/**
 * Measure text width for a cell value (plain text approximation).
 */
function measureCellText(doc, text, fontSize) {
  doc.font('Helvetica').fontSize(fontSize);
  return doc.widthOfString(stripInlineMarkdown(text));
}

/**
 * Render a markdown table into the PDF.
 * tableLines: array of raw pipe-delimited lines (header, separator, data rows).
 */
function renderTable(doc, tableLines, repoPath, filePath, destinations) {
  if (tableLines.length < 2) return;

  // Parse cells from pipe-delimited line
  function parseCells(line) {
    return line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
  }

  const headerCells = parseCells(tableLines[0]);
  const numCols = headerCells.length;

  // Skip separator line (index 1), parse data rows
  const dataRows = [];
  for (let i = 2; i < tableLines.length; i++) {
    const cells = parseCells(tableLines[i]);
    // Pad or trim to match header column count
    while (cells.length < numCols) cells.push('');
    dataRows.push(cells.slice(0, numCols));
  }

  // Calculate column widths proportionally based on content
  const maxContentWidths = new Array(numCols).fill(0);
  doc.font('Helvetica-Bold').fontSize(TABLE_SIZE);
  for (let c = 0; c < numCols; c++) {
    maxContentWidths[c] = doc.widthOfString(stripInlineMarkdown(headerCells[c]));
  }
  doc.font('Helvetica').fontSize(TABLE_SIZE);
  for (const row of dataRows) {
    for (let c = 0; c < numCols; c++) {
      const w = doc.widthOfString(stripInlineMarkdown(row[c]));
      if (w > maxContentWidths[c]) maxContentWidths[c] = w;
    }
  }

  // Distribute available width proportionally (with min width)
  const totalContentWidth = CONTENT_WIDTH - (TABLE_CELL_PAD * 2 * numCols);
  const totalMeasured = maxContentWidths.reduce((s, w) => s + w, 0) || 1;
  const colWidths = maxContentWidths.map(w => {
    const proportional = (w / totalMeasured) * totalContentWidth;
    return Math.max(proportional, 40); // minimum 40pt per column
  });

  // Normalize so they sum to CONTENT_WIDTH
  const totalAllocated = colWidths.reduce((s, w) => s + w, 0);
  const scale = CONTENT_WIDTH / totalAllocated;
  for (let c = 0; c < numCols; c++) {
    colWidths[c] = colWidths[c] * scale;
  }

  const cellTextWidth = (c) => colWidths[c] - TABLE_CELL_PAD * 2;

  // Measure row height by computing how many lines the text wraps
  function rowHeight(cells, isBold) {
    let maxH = 0;
    for (let c = 0; c < numCols; c++) {
      const text = stripInlineMarkdown(cells[c] || '');
      doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(TABLE_SIZE);
      const h = doc.heightOfString(text, { width: cellTextWidth(c) });
      if (h > maxH) maxH = h;
    }
    return maxH + TABLE_CELL_PAD * 2;
  }

  doc.moveDown(0.3);

  // Check if we need a new page for the table header
  const headerH = rowHeight(headerCells, true);
  if (doc.y + headerH > 700) {
    doc.addPage();
  }

  // Draw header row
  let startY = doc.y;
  let xPos = MARGIN;

  // Header background
  doc.save();
  doc.rect(MARGIN, startY, CONTENT_WIDTH, headerH).fill('#f7fafc');
  doc.restore();

  for (let c = 0; c < numCols; c++) {
    const text = stripInlineMarkdown(headerCells[c]);
    doc.font('Helvetica-Bold').fontSize(TABLE_SIZE).fillColor('#1a202c');
    doc.text(text, xPos + TABLE_CELL_PAD, startY + TABLE_CELL_PAD, {
      width: cellTextWidth(c),
      lineGap: 1,
    });
    xPos += colWidths[c];
  }

  // Draw header borders
  doc.moveTo(MARGIN, startY).lineTo(MARGIN + CONTENT_WIDTH, startY)
    .lineWidth(0.5).strokeColor('#cbd5e0').stroke();
  doc.moveTo(MARGIN, startY + headerH).lineTo(MARGIN + CONTENT_WIDTH, startY + headerH)
    .lineWidth(1).strokeColor('#a0aec0').stroke();

  doc.y = startY + headerH;

  // Draw data rows
  for (let r = 0; r < dataRows.length; r++) {
    const cells = dataRows[r];
    const rH = rowHeight(cells, false);

    // Check page break
    if (doc.y + rH > 720) {
      doc.addPage();
    }

    const rowY = doc.y;

    // Alternate row background
    if (r % 2 === 1) {
      doc.save();
      doc.rect(MARGIN, rowY, CONTENT_WIDTH, rH).fill('#f7fafc');
      doc.restore();
    }

    xPos = MARGIN;
    for (let c = 0; c < numCols; c++) {
      const cellText = cells[c] || '';
      // Render with inline formatting (bold, links, etc.)
      const segments = parseInlineSegments(cellText);
      doc.fontSize(TABLE_SIZE);
      let cellX = xPos + TABLE_CELL_PAD;
      let cellY = rowY + TABLE_CELL_PAD;
      const cw = cellTextWidth(c);

      for (let si = 0; si < segments.length; si++) {
        const seg = segments[si];
        const isLast = si === segments.length - 1;

        if (seg.code) {
          doc.font('Courier').fontSize(TABLE_SIZE - 1);
        } else if (seg.bold && seg.italic) {
          doc.font('Helvetica-BoldOblique').fontSize(TABLE_SIZE);
        } else if (seg.bold) {
          doc.font('Helvetica-Bold').fontSize(TABLE_SIZE);
        } else if (seg.italic) {
          doc.font('Helvetica-Oblique').fontSize(TABLE_SIZE);
        } else {
          doc.font('Helvetica').fontSize(TABLE_SIZE);
        }
        doc.fillColor(seg.color || '#1a202c');

        const tOpts = { continued: !isLast, width: cw, lineGap: 1 };
        if (seg.link) {
          tOpts.link = seg.link;
          tOpts.underline = true;
        } else if (seg.internalHref && destinations) {
          const dest = resolveInternalLink(seg.internalHref, filePath, destinations);
          if (dest) {
            tOpts.goTo = dest;
            tOpts.underline = true;
          } else {
            tOpts.underline = false;
          }
        } else {
          tOpts.underline = false;
        }

        if (si === 0) {
          doc.text(seg.text, cellX, cellY, tOpts);
        } else {
          doc.text(seg.text, tOpts);
        }
      }

      xPos += colWidths[c];
    }

    // Row bottom border
    doc.moveTo(MARGIN, rowY + rH).lineTo(MARGIN + CONTENT_WIDTH, rowY + rH)
      .lineWidth(0.5).strokeColor('#e2e8f0').stroke();

    doc.y = rowY + rH;
  }

  // Draw vertical column borders
  const tableTop = startY;
  const tableBottom = doc.y;
  xPos = MARGIN;
  for (let c = 0; c <= numCols; c++) {
    doc.moveTo(xPos, tableTop).lineTo(xPos, tableBottom)
      .lineWidth(0.5).strokeColor('#e2e8f0').stroke();
    if (c < numCols) xPos += colWidths[c];
  }

  doc.font('Helvetica').fontSize(BODY_SIZE).fillColor('#1a202c');
  doc.moveDown(0.5);
}

/**
 * Resolve an image path relative to a markdown file.
 * Returns the absolute path if the image exists, null otherwise.
 */
function resolveImage(repoPath, mdFilePath, imgSrc) {
  if (imgSrc.startsWith('http://') || imgSrc.startsWith('https://')) return null;
  const fileDir = path.dirname(path.join(repoPath, mdFilePath));
  const absPath = path.resolve(fileDir, imgSrc);
  if (fs.existsSync(absPath)) return absPath;
  return null;
}

/**
 * Detect if a line is a table separator (e.g. |---|---|).
 */
function isTableSeparator(line) {
  return /^\s*\|?[\s:]*-{2,}[\s:]*(\|[\s:]*-{2,}[\s:]*)*\|?\s*$/.test(line);
}

/**
 * Detect if a line looks like a table row (has pipes).
 */
function isTableRow(line) {
  const trimmed = line.trim();
  return trimmed.includes('|') && !trimmed.startsWith('```');
}

/**
 * Render a single markdown file into the PDFDocument.
 * destinations: Set of file paths that have named destinations in the PDF.
 */
function renderMarkdownFile(doc, repoPath, filePath, destinations) {
  const fullPath = path.join(repoPath, filePath);
  if (!fs.existsSync(fullPath)) return;

  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');

  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeLines = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code blocks
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        if (codeBlockLang === 'mermaid') {
          // Mermaid diagram placeholder
          doc.fontSize(BODY_SIZE).font('Helvetica-Oblique');
          doc.fillColor('#718096')
            .text('<Workflow_Diagram_Here>', MARGIN, undefined, {
              width: CONTENT_WIDTH,
              align: 'center'
            });
          doc.fillColor('#1a202c').font('Helvetica');
        } else {
          // Regular code block — render accumulated lines
          const codeText = codeLines.join('\n');
          if (codeText.trim()) {
            doc.fontSize(CODE_SIZE).font('Courier');
            doc.fillColor('#334155')
              .text(codeText, MARGIN + 8, undefined, { width: CONTENT_WIDTH - 16 });
            doc.fillColor('#1a202c');
          }
        }
        doc.moveDown(0.5);
        codeLines = [];
        inCodeBlock = false;
        codeBlockLang = '';
        doc.font('Helvetica');
        continue;
      } else {
        inCodeBlock = true;
        codeBlockLang = line.trimStart().replace(/^```/, '').trim().toLowerCase();
        codeLines = [];
        doc.moveDown(0.3);
        continue;
      }
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Table detection: if this line and the next form a table header + separator
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const tableLines = [line, lines[i + 1]];
      let j = i + 2;
      while (j < lines.length && isTableRow(lines[j]) && !isTableSeparator(lines[j])) {
        tableLines.push(lines[j]);
        j++;
      }
      renderTable(doc, tableLines, repoPath, filePath, destinations);
      i = j - 1; // skip past table rows
      continue;
    }

    // Skip table separator lines that appear without a header (shouldn't happen, but defensive)
    if (isTableSeparator(line)) {
      continue;
    }

    // Skip blank lines (add small spacing)
    if (line.trim() === '') {
      if (inList) {
        inList = false;
      }
      doc.moveDown(0.3);
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      doc.moveDown(0.5);
      const y = doc.y;
      doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
      doc.moveDown(0.5);
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = stripInlineMarkdown(headingMatch[2]);
      const fontSize = HEADING_SIZES[level] || BODY_SIZE;

      doc.moveDown(level <= 2 ? 0.8 : 0.5);
      doc.fontSize(fontSize).font('Helvetica-Bold');
      doc.fillColor('#1a202c').text(text, MARGIN, undefined, { width: CONTENT_WIDTH });

      // Underline for h1/h2
      if (level <= 2) {
        const y = doc.y + 2;
        doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y)
          .lineWidth(0.5).strokeColor(level === 1 ? '#e2e8f0' : '#edf2f7').stroke();
        doc.moveDown(0.3);
      }

      doc.font('Helvetica').fontSize(BODY_SIZE);
      doc.moveDown(0.3);
      continue;
    }

    // Images (standalone line)
    const imgMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch && line.trim().startsWith('!')) {
      const imgSrc = imgMatch[2];
      const imgPath = resolveImage(repoPath, filePath, imgSrc);
      if (imgPath) {
        try {
          if (doc.y > 600) {
            doc.addPage();
          }
          const maxW = Math.min(CONTENT_WIDTH, 450);
          doc.image(imgPath, MARGIN, undefined, { width: maxW, align: 'center' });
          doc.moveDown(0.5);
        } catch {
          // Skip images that fail to load
        }
      }
      continue;
    }

    // Blockquote
    if (line.trimStart().startsWith('>')) {
      const bqText = line.replace(/^\s*>\s?/, '');
      if (bqText.trim()) {
        const y = doc.y;
        doc.fontSize(BODY_SIZE).fillColor('#2c5282');
        renderInlineText(doc, bqText, MARGIN + 16, { width: CONTENT_WIDTH - 16, fontSize: BODY_SIZE, currentFilePath: filePath, destinations });
        const endY = doc.y;
        doc.moveTo(MARGIN + 8, y).lineTo(MARGIN + 8, endY)
          .lineWidth(2).strokeColor('#4a90d9').stroke();
        doc.fillColor('#1a202c').font('Helvetica');
        doc.moveDown(0.3);
      }
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[*\-+]\s+(.*)/);
    if (ulMatch) {
      inList = true;
      const indent = Math.floor(ulMatch[1].length / 2);
      const xOffset = MARGIN + 12 + indent * 16;
      doc.fontSize(BODY_SIZE).font('Helvetica');

      // Bullet
      doc.fillColor('#718096').text('\u2022', xOffset - 10, doc.y, { continued: false });
      doc.moveUp();
      renderInlineText(doc, ulMatch[2], xOffset, { width: CONTENT_WIDTH - (xOffset - MARGIN), currentFilePath: filePath, destinations });
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
    if (olMatch) {
      inList = true;
      const indent = Math.floor(olMatch[1].length / 2);
      const num = olMatch[2];
      const xOffset = MARGIN + 16 + indent * 16;
      doc.fontSize(BODY_SIZE).font('Helvetica');

      doc.fillColor('#718096').text(num + '.', xOffset - 16, doc.y, { continued: false, width: 14, align: 'right' });
      doc.moveUp();
      renderInlineText(doc, olMatch[3], xOffset, { width: CONTENT_WIDTH - (xOffset - MARGIN), currentFilePath: filePath, destinations });
      continue;
    }

    // Regular paragraph text — render with inline formatting
    if (line.trim()) {
      renderInlineText(doc, line, MARGIN, { width: CONTENT_WIDTH, lineGap: 3, currentFilePath: filePath, destinations });
    }
  }
}

/**
 * Build the PDF synchronously (CPU-bound, runs in background via startBuild).
 * Returns a Promise that resolves when the PDF is written.
 */
function buildPdf(repoPath, repoName, pdfPath) {
  return new Promise((resolve, reject) => {
    const orderedFiles = getOrderedFiles(repoPath);

    // Build a set of all file paths that will be in the PDF (for internal link resolution)
    const destinations = new Set(orderedFiles);

    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
      autoFirstPage: true,
      info: {
        Title: repoName,
        Author: 'Documentation Tool',
      },
    });

    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    for (let i = 0; i < orderedFiles.length; i++) {
      const filePath = orderedFiles[i];
      console.log(`[PDF]   Processing file ${i + 1}/${orderedFiles.length}: ${filePath}`);

      if (i > 0) {
        doc.addPage();
      }

      // Add a named destination so internal links can jump here
      doc.addNamedDestination(filePath);

      renderMarkdownFile(doc, repoPath, filePath, destinations);
    }

    doc.end();

    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}

/**
 * Run PDF generation in the background.
 */
function startBuild(repoPath, repoName) {
  const state = getState(repoName);
  if (state.status === 'building') return;

  state.status = 'building';
  state.error = null;

  const cacheDir = path.join(repoPath, '.pdf-cache');
  const pdfPath = path.join(cacheDir, repoName + '.pdf');

  (async () => {
    const startTime = Date.now();
    try {
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      const orderedFiles = getOrderedFiles(repoPath);
      console.log(`[PDF] Building PDF for ${repoName}...`);
      console.log(`[PDF]   ${orderedFiles.length} markdown files in index order`);

      await buildPdf(repoPath, repoName, pdfPath);

      const pdfSize = (fs.statSync(pdfPath).size / 1024 / 1024).toFixed(1);
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

      state.status = 'ready';
      state.pdfPath = pdfPath;
      state.error = null;
      console.log(`[PDF] PDF ready for ${repoName} (${pdfSize} MB) — ${totalTime}s`);
    } catch (err) {
      state.status = 'error';
      state.error = err.message;
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`[PDF] Failed to build PDF for ${repoName} after ${totalTime}s:`, err.message);
    }
  })();
}

/**
 * Get the current PDF status for a repo.
 */
function getStatus(repoName) {
  const state = getState(repoName);
  return { status: state.status, pdfPath: state.pdfPath, error: state.error };
}

/**
 * Invalidate the cached PDF and kick off a rebuild.
 */
function invalidateCache(repoName, repoPath) {
  const state = getState(repoName);
  state.status = 'idle';
  state.pdfPath = null;
  state.error = null;

  const cacheDir = path.join(repoPath, '.pdf-cache');
  const pdfFile = path.join(cacheDir, repoName + '.pdf');
  try { fs.unlinkSync(pdfFile); } catch { /* ignore */ }

  startBuild(repoPath, repoName);
}

/**
 * On startup, check if PDF exists; if not, start building.
 */
function ensurePdf(repoPath, repoName) {
  const cacheDir = path.join(repoPath, '.pdf-cache');
  const pdfFile = path.join(cacheDir, repoName + '.pdf');

  if (fs.existsSync(pdfFile)) {
    const state = getState(repoName);
    state.status = 'ready';
    state.pdfPath = pdfFile;
    console.log(`[PDF] Cached PDF found for ${repoName}`);
  } else {
    startBuild(repoPath, repoName);
  }
}

module.exports = { startBuild, getStatus, invalidateCache, ensurePdf };
