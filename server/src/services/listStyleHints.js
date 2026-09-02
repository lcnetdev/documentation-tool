/**
 * The LIST_STYLE hint plugin, rebuilt for the HTML export. Behaves the same
 * as client/src/utils/listStyleHints.js; the two are kept in sync by hand.
 *
 *   <!-- LIST_STYLE: compact two-column -->
 *   - item
 */
const HINT_RE = /^<!--\s*LIST_STYLE:\s*([^>]*?)\s*-->\s*$/i;

const LIST_STYLE_CLASSES = {
  compact: 'list-compact',
  'two-column': 'list-two-column',
  'three-column': 'list-three-column'
};

function parseListStyleHint(html) {
  const match = HINT_RE.exec(String(html || '').trim());
  if (!match) return null;
  const words = match[1].split(/[\s,]+/).filter(Boolean).map((w) => w.toLowerCase());
  const classes = words.map((w) => LIST_STYLE_CLASSES[w]).filter(Boolean);
  return { words, classes };
}

function listStyleHints(md) {
  md.core.ruler.push('list_style_hints', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type !== 'html_block') continue;
      const hint = parseListStyleHint(token.content);
      if (!hint) continue;
      token.content = '';
      const next = tokens[i + 1];
      if (next && (next.type === 'bullet_list_open' || next.type === 'ordered_list_open') && hint.classes.length) {
        next.attrJoin('class', hint.classes.join(' '));
      }
    }
  });
}

/** The CSS that goes with those classes; embedded in the exported page. */
const LIST_STYLE_CSS = `
  ul.list-compact, ol.list-compact { margin: 0.5em 0; }
  ul.list-compact { list-style: none; padding-left: 0; }
  .list-compact li { margin: 0.1em 0; line-height: 1.4; }
  .list-two-column { column-count: 2; column-gap: 2.5em; }
  .list-three-column { column-count: 3; column-gap: 2.5em; }
  .list-two-column li, .list-three-column li { break-inside: avoid; }
  @media (max-width: 700px) { .list-two-column, .list-three-column { column-count: 1; } }`;

module.exports = { listStyleHints, parseListStyleHint, LIST_STYLE_CLASSES, LIST_STYLE_CSS };
