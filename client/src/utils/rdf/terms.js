/**
 * A tiny RDF term model (plain objects matching the RDF/JS shapes) with
 * prefix helpers alongside it.
 *
 * Terms stay as plain objects so nothing here needs a library to create
 * or read them:
 *   { termType: 'NamedNode', value }
 *   { termType: 'BlankNode', value }
 *   { termType: 'Literal', value, language, datatype: NamedNode }
 */

export const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
export const RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#'
export const XSD_NS = 'http://www.w3.org/2001/XMLSchema#'
export const XML_NS = 'http://www.w3.org/XML/1998/namespace'
export const XMLNS_NS = 'http://www.w3.org/2000/xmlns/'

export const RDF = {
  type: RDF_NS + 'type',
  first: RDF_NS + 'first',
  rest: RDF_NS + 'rest',
  nil: RDF_NS + 'nil',
  Statement: RDF_NS + 'Statement',
  subject: RDF_NS + 'subject',
  predicate: RDF_NS + 'predicate',
  object: RDF_NS + 'object',
  XMLLiteral: RDF_NS + 'XMLLiteral',
  langString: RDF_NS + 'langString'
}

export const XSD = {
  string: XSD_NS + 'string',
  boolean: XSD_NS + 'boolean',
  integer: XSD_NS + 'integer',
  decimal: XSD_NS + 'decimal',
  double: XSD_NS + 'double'
}

/**
 * Namespaces assumed for prefixes that an RDF/XML snippet uses without
 * declaring. Documentation examples routinely omit xmlns declarations
 * "for brevity", so we fill in the common ones (prefix.cc conventions plus
 * the Library of Congress vocabularies).
 */
export const WELL_KNOWN_PREFIXES = {
  rdf: RDF_NS,
  rdfs: RDFS_NS,
  xsd: XSD_NS,
  owl: 'http://www.w3.org/2002/07/owl#',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  skosxl: 'http://www.w3.org/2008/05/skos-xl#',
  foaf: 'http://xmlns.com/foaf/0.1/',
  dc: 'http://purl.org/dc/elements/1.1/',
  dcterms: 'http://purl.org/dc/terms/',
  dct: 'http://purl.org/dc/terms/',
  dctype: 'http://purl.org/dc/dcmitype/',
  schema: 'http://schema.org/',
  sdo: 'https://schema.org/',
  bf: 'http://id.loc.gov/ontologies/bibframe/',
  bflc: 'http://id.loc.gov/ontologies/bflc/',
  lclocal: 'http://id.loc.gov/ontologies/lclocal/',
  madsrdf: 'http://www.loc.gov/mads/rdf/v1#',
  mads: 'http://www.loc.gov/mads/rdf/v1#',
  relators: 'http://id.loc.gov/vocabulary/relators/',
  identifiers: 'http://id.loc.gov/vocabulary/identifiers/',
  pmo: 'http://performedmusicontology.org/ontology/',
  premis: 'http://www.loc.gov/premis/rdf/v3/',
  prov: 'http://www.w3.org/ns/prov#',
  void: 'http://rdfs.org/ns/void#',
  dcat: 'http://www.w3.org/ns/dcat#',
  org: 'http://www.w3.org/ns/org#',
  vcard: 'http://www.w3.org/2006/vcard/ns#',
  geo: 'http://www.w3.org/2003/01/geo/wgs84_pos#',
  time: 'http://www.w3.org/2006/time#',
  sh: 'http://www.w3.org/ns/shacl#',
  oa: 'http://www.w3.org/ns/oa#',
  ldp: 'http://www.w3.org/ns/ldp#',
  cc: 'http://creativecommons.org/ns#',
  bibo: 'http://purl.org/ontology/bibo/',
  bio: 'http://purl.org/vocab/bio/0.1/',
  gn: 'http://www.geonames.org/ontology#',
  wd: 'http://www.wikidata.org/entity/',
  wdt: 'http://www.wikidata.org/prop/direct/',
  dbo: 'http://dbpedia.org/ontology/',
  dbr: 'http://dbpedia.org/resource/',
  rdau: 'http://rdaregistry.info/Elements/u/',
  edm: 'http://www.europeana.eu/schemas/edm/',
  ore: 'http://www.openarchives.org/ore/terms/',
  ex: 'http://example.org/'
}

export function namedNode(value) {
  return { termType: 'NamedNode', value }
}

export function blankNode(value) {
  return { termType: 'BlankNode', value }
}

/**
 * @param {string} value
 * @param {string|object} [languageOrDatatype] a language tag string, or the datatype as a NamedNode
 */
export function literal(value, languageOrDatatype) {
  if (typeof languageOrDatatype === 'string' && languageOrDatatype) {
    return { termType: 'Literal', value, language: languageOrDatatype, datatype: namedNode(RDF.langString) }
  }
  if (languageOrDatatype && typeof languageOrDatatype === 'object') {
    return { termType: 'Literal', value, language: '', datatype: languageOrDatatype }
  }
  return { termType: 'Literal', value, language: '', datatype: namedNode(XSD.string) }
}

export function quad(subject, predicate, object) {
  return { subject, predicate, object }
}

/** A term's stable identity string, handy as a Map key. */
export function termKey(term) {
  switch (term.termType) {
    case 'NamedNode': return '<' + term.value + '>'
    case 'BlankNode': return '_:' + term.value
    case 'Literal':
      return JSON.stringify(term.value) + (term.language ? '@' + term.language : '^^' + term.datatype.value)
    default: return term.termType + ':' + term.value
  }
}

export function termEquals(a, b) {
  return termKey(a) === termKey(b)
}

export function isNamedNode(term) { return term.termType === 'NamedNode' }
export function isBlankNode(term) { return term.termType === 'BlankNode' }
export function isLiteral(term) { return term.termType === 'Literal' }

/**
 * Shorten an IRI with a prefix map, picking the longest namespace that fits.
 *
 * @param {string} iri
 * @param {Object<string,string>} prefixes prefix -> namespace
 * @param {object} [options]
 * @param {boolean} [options.allowEmptyPrefix=true] whether the '' (default) prefix is allowed
 * @param {function} [options.validateLocal] predicate the local part has to satisfy
 * @returns {string|null} "prefix:local", or null if no prefix fits
 */
export function compactIri(iri, prefixes, options = {}) {
  const allowEmptyPrefix = options.allowEmptyPrefix !== false
  let best = null
  for (const prefix of Object.keys(prefixes)) {
    const ns = prefixes[prefix]
    if (!ns || !iri.startsWith(ns) || iri.length === ns.length) continue
    if (prefix === '' && !allowEmptyPrefix) continue
    if (!best || ns.length > best.ns.length) best = { prefix, ns }
  }
  if (!best) return null
  const local = iri.slice(best.ns.length)
  if (options.validateLocal && !options.validateLocal(local)) return null
  return best.prefix + ':' + local
}

/** Every IRI a serializer would have to spell out for these quads. */
export function* iriTerms(quads) {
  for (const q of quads) {
    for (const term of [q.subject, q.predicate, q.object]) {
      if (term.termType === 'NamedNode') yield term.value
      else if (term.termType === 'Literal' && !term.language &&
               term.datatype.value !== XSD.string) yield term.datatype.value
    }
  }
}

/**
 * Filters `prefixes` down to the ones that genuinely shorten some IRI in
 * `quads`, keeping the original insertion order.
 */
export function usedPrefixes(quads, prefixes, options = {}) {
  const used = new Set()
  for (const iri of iriTerms(quads)) {
    const compact = compactIri(iri, prefixes, options)
    if (compact) used.add(compact.slice(0, compact.indexOf(':')))
  }
  const result = {}
  for (const prefix of Object.keys(prefixes)) {
    if (used.has(prefix)) result[prefix] = prefixes[prefix]
  }
  return result
}

/**
 * Throws in the standard prefixes (rdf, rdfs, xsd) when the quads lean on
 * those namespaces and the source never declared them.
 */
export function withStandardPrefixes(quads, prefixes) {
  const result = Object.assign({}, prefixes)
  const declaredNs = new Set(Object.values(result))
  const standard = { rdf: RDF_NS, rdfs: RDFS_NS, xsd: XSD_NS }
  const seen = new Set(iriTerms(quads))
  for (const prefix of Object.keys(standard)) {
    const ns = standard[prefix]
    if (declaredNs.has(ns) || prefix in result) continue
    for (const iri of seen) {
      if (iri.startsWith(ns)) { result[prefix] = ns; break }
    }
  }
  return result
}

/** Trims a long IRI for display, hanging onto both ends. */
export function shortenIri(iri, max = 48) {
  if (iri.length <= max) return iri
  const keep = Math.floor((max - 1) / 2)
  return iri.slice(0, keep) + '…' + iri.slice(iri.length - keep)
}
