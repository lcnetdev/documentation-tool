/**
 * Prism-based syntax highlighting. All grammars get pulled in once here;
 * the markdown renderer then runs highlightCode() on each fenced block.
 */
import Prism from 'prismjs'
import 'prismjs/components/prism-turtle'
import 'prismjs/components/prism-sparql'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-typescript'

// We always highlight from strings, so stop Prism from scanning the page on load.
Prism.manual = true

const PLAIN = new Set(['plain', 'plaintext', 'text', 'txt'])

const ALIASES = {
  xml: 'markup', html: 'markup', svg: 'markup', xhtml: 'markup', rss: 'markup', atom: 'markup',
  rdf: 'markup', rdfxml: 'markup', 'rdf-xml': 'markup', 'rdf/xml': 'markup', 'application/rdf+xml': 'markup',
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript',
  ttl: 'turtle', n3: 'turtle', trig: 'turtle',
  jsonld: 'json', 'json-ld': 'json', json5: 'json',
  rq: 'sparql',
  sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash',
  py: 'python',
  yml: 'yaml',
  md: 'markdown'
}

/**
 * Resolve a fence language tag to the name of a Prism grammar we have loaded.
 * @returns {string|null}
 */
export function resolveLanguage(lang) {
  if (!lang) return null
  const name = String(lang).trim().toLowerCase()
  const resolved = ALIASES[name] || name
  // Prism hands plain text an empty grammar — treat that as "nothing to highlight"
  if (PLAIN.has(resolved)) return null
  return Prism.languages[resolved] ? resolved : null
}

/**
 * @param {string} code
 * @param {string} lang
 * @returns {{ html: string, language: string }|null} null if there's no grammar for it
 */
export function highlightCode(code, lang) {
  const language = resolveLanguage(lang)
  if (!language) return null
  return { html: Prism.highlight(code, Prism.languages[language], language), language }
}
