/**
 * markdown-it plugin that reads list layout hints out of the document.
 *
 * The author puts an HTML comment right above a list, and the list picks
 * up the matching layout classes:
 *
 *   <!-- LIST_STYLE: compact two-column -->
 *   - [bf:classification](...)
 *   - [bf:content](...)
 *
 * compact, two-column and three-column are the words we recognize; anything
 * else is skipped. The comment never makes it into the output, and a hint
 * with no list after it is simply ignored.
 */

const HINT_RE = /^<!--\s*LIST_STYLE:\s*([^>]*?)\s*-->\s*$/i

export const LIST_STYLE_CLASSES = {
  compact: 'list-compact',
  'two-column': 'list-two-column',
  'three-column': 'list-three-column'
}

/** @returns {{ words: string[], classes: string[] }|null} */
export function parseListStyleHint(html) {
  const match = HINT_RE.exec(String(html || '').trim())
  if (!match) return null
  const words = match[1].split(/[\s,]+/).filter(Boolean).map(w => w.toLowerCase())
  const classes = words.map(w => LIST_STYLE_CLASSES[w]).filter(Boolean)
  return { words, classes }
}

export default function listStyleHints(md) {
  md.core.ruler.push('list_style_hints', state => {
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      if (token.type !== 'html_block') continue
      const hint = parseListStyleHint(token.content)
      if (!hint) continue
      token.content = ''
      const next = tokens[i + 1]
      if (next && (next.type === 'bullet_list_open' || next.type === 'ordered_list_open') && hint.classes.length) {
        next.attrJoin('class', hint.classes.join(' '))
      }
    }
  })
}
