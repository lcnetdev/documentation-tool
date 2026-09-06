/**
 * Lays out a namespace-only RDF/XML document — an rdf:RDF root carrying
 * nothing but its attributes — with one attribute per line, for the HTML
 * download and the PDF. CommonJS copy of client/src/utils/rdf/emptyRoot.js,
 * which the viewer uses; keep the two in step.
 */

const NAME = '[A-Za-z_][\\w.-]*';
const QNAME = NAME + '(?::' + NAME + ')?';
const VALUE = '(?:"[^"]*"|\'[^\']*\')';
const EMPTY_ROOT = new RegExp(
  '^\\uFEFF?\\s*(?:<\\?xml[^>]*\\?>\\s*)?' +
  '<(' + NAME + '):RDF((?:\\s+' + QNAME + '\\s*=\\s*' + VALUE + ')*)\\s*(/>|>\\s*</\\1:RDF\\s*>)\\s*$'
);
const ATTRIBUTE = new RegExp('(' + QNAME + ')\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')', 'g');
const INDENT = '    ';

/**
 * Picks apart an rdf:RDF element that has attributes but no content.
 *
 * @param {string} text
 * @returns {{ prefix: string, attributes: Array<{ name: string, value: string }>, selfClosing: boolean }|null}
 *   null for anything else: a fragment, a document with nodes, malformed XML
 */
function parseEmptyRdfRoot(text) {
  const m = EMPTY_ROOT.exec(String(text == null ? '' : text));
  if (!m) return null;
  const attributes = [];
  ATTRIBUTE.lastIndex = 0;
  let a;
  while ((a = ATTRIBUTE.exec(m[2])) !== null) {
    attributes.push({ name: a[1], value: a[2] != null ? a[2] : a[3] });
  }
  return { prefix: m[1], attributes, selfClosing: m[3] === '/>' };
}

function quote(value) {
  return value.includes('"') ? "'" + value + "'" : '"' + value + '"';
}

/**
 * @returns {string|null} the root with one attribute per line, or null when
 *   there is nothing to lay out, so callers fall back to the original text
 */
function formatEmptyRdfXml(text) {
  const root = parseEmptyRdfRoot(text);
  if (!root || !root.attributes.length) return null;
  const open = '<' + root.prefix + ':RDF';
  const close = root.selfClosing ? '/>' : '>\n</' + root.prefix + ':RDF>';
  return [open, ...root.attributes.map(a => INDENT + a.name + '=' + quote(a.value)), close].join('\n');
}

module.exports = { parseEmptyRdfRoot, formatEmptyRdfXml };
