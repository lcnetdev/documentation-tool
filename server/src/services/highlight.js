/**
 * Highlights code server-side for the standalone HTML download. Matches the
 * client's Prism setup (client/src/utils/highlight.js) so exported pages look
 * the same as they do in the viewer.
 */
const Prism = require('prismjs');
const loadLanguages = require('prismjs/components/');

loadLanguages(['turtle', 'sparql', 'json', 'python', 'bash', 'yaml', 'sql', 'markdown', 'typescript']);

const PLAIN = new Set(['plain', 'plaintext', 'text', 'txt']);

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
};

function resolveLanguage(lang) {
  if (!lang) return null;
  const name = String(lang).trim().toLowerCase();
  const resolved = ALIASES[name] || name;
  // Prism hands plain text an empty grammar — treat that as "nothing to highlight"
  if (PLAIN.has(resolved)) return null;
  return Prism.languages[resolved] ? resolved : null;
}

/**
 * @returns {{ html: string, language: string }|null} null if there's no grammar for it
 */
function highlightCode(code, lang) {
  const language = resolveLanguage(lang);
  if (!language) return null;
  return { html: Prism.highlight(code, Prism.languages[language], language), language };
}

/** Colours for the tokens on the exported (light) page, matching the client's light palette. */
const TOKEN_CSS = `
  pre code .token.comment, pre code .token.prolog, pre code .token.doctype, pre code .token.cdata { color: #6e7781; font-style: italic; }
  pre code .token.punctuation { color: #57606a; }
  pre code .token.tag, pre code .token.selector, pre code .token.inserted { color: #116329; }
  pre code .token.tag .token.punctuation { color: #57606a; }
  pre code .token.namespace, pre code .token.function .token.prefix { color: #8250df; }
  pre code .token.attr-name, pre code .token.property, pre code .token.boolean, pre code .token.number, pre code .token.constant, pre code .token.symbol { color: #0550ae; }
  pre code .token.attr-value, pre code .token.string, pre code .token.char, pre code .token.url, pre code .token.regex { color: #0a3069; }
  pre code .token.attr-value .token.punctuation, pre code .token.url .token.punctuation { color: #0a3069; }
  pre code .token.attr-value .token.punctuation.attr-equals { color: #57606a; }
  pre code .token.keyword, pre code .token.atrule, pre code .token.important, pre code .token.deleted { color: #cf222e; }
  pre code .token.function, pre code .token.class-name, pre code .token.builtin { color: #8250df; }
  pre code .token.function .token.local-name { color: #116329; }
  pre code .token.operator, pre code .token.entity, pre code .token.variable { color: #953800; }
  pre code .token.bold { font-weight: 600; }
  pre code .token.italic { font-style: italic; }`;

module.exports = { highlightCode, resolveLanguage, TOKEN_CSS };
