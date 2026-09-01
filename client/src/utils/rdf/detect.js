/**
 * A quick, dependency-free sniff the markdown renderer uses to work out
 * whether a fenced code block deserves the RDF conversion tabs.
 */

const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'

/** Language tags on a fence that we always read as RDF/XML. */
export const RDF_XML_LANGS = new Set(['rdf', 'rdfxml', 'rdf-xml', 'rdf/xml', 'application/rdf+xml'])

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Whichever prefix the text binds to the RDF namespace; "rdf" if none. */
export function rdfPrefixIn(code) {
  const re = /xmlns:([A-Za-z_][\w.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  let m
  while ((m = re.exec(code)) !== null) {
    if ((m[2] || m[3]) === RDF_NS) return m[1]
  }
  return 'rdf'
}

/**
 * @param {string} lang the fence's language tag (possibly empty)
 * @param {string} code the code inside the fence
 */
export function looksLikeRdfXml(lang, code) {
  const l = (lang || '').trim().toLowerCase()
  if (RDF_XML_LANGS.has(l)) return true
  if (l !== '' && l !== 'xml') return false
  if (!code || code.indexOf('<') === -1) return false
  const p = escapeRegExp(rdfPrefixIn(code))
  const re = new RegExp(
    '<' + p + ':(?:RDF|Description)(?=[\\s/>])' +
    '|\\s' + p + ':(?:about|resource|nodeID|ID|parseType|datatype)\\s*='
  )
  return re.test(code)
}
