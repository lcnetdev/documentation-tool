/**
 * Writes quads out as Turtle, nesting blank nodes and using collection syntax.
 */

import { RDF, XSD, compactIri, usedPrefixes, termKey, isBlankNode } from './terms'
import { analyze, groupByPredicate } from './structure'

const INDENT = '    '
const PN_PREFIX = /^(?:[\p{L}_](?:[\p{L}\p{N}_.-]*[\p{L}\p{N}_-])?)?$/u
const PN_LOCAL = /^(?:[\p{L}\p{N}_:]|%[0-9A-Fa-f]{2})(?:(?:[\p{L}\p{N}_:.·-]|%[0-9A-Fa-f]{2})*(?:[\p{L}\p{N}_:-]|%[0-9A-Fa-f]{2}))?$/u
const IRI_ESCAPE = /[\u0000-\u0020<>"{}|^`\\]/g
const STRING_ESCAPE = /[\\"\n\r\t\b\f\u0000-\u001F]/g

function validLocal(local) {
  return PN_LOCAL.test(local)
}

function unicodeEscape(ch) {
  return '\\u' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')
}

function escapeIri(iri) {
  return iri.replace(IRI_ESCAPE, unicodeEscape)
}

function escapeString(value) {
  return value.replace(STRING_ESCAPE, ch => {
    switch (ch) {
      case '\\': return '\\\\'
      case '"': return '\\"'
      case '\n': return '\\n'
      case '\r': return '\\r'
      case '\t': return '\\t'
      case '\b': return '\\b'
      case '\f': return '\\f'
      default: return unicodeEscape(ch)
    }
  })
}

function encodeStringValue(value) {
  if (value.includes('\n') && !value.includes('"""')) {
    const body = value.replace(/\\/g, '\\\\').replace(/"$/, '\\"')
    return '"""' + body + '"""'
  }
  return '"' + escapeString(value) + '"'
}

/**
 * @param {Set<string>} [used] collects the prefix whenever a prefixed name gets written
 */
export function encodeIri(iri, prefixes, used) {
  const compact = compactIri(iri, prefixes, { validateLocal: validLocal })
  if (compact === null) return '<' + escapeIri(iri) + '>'
  if (used) used.add(compact.slice(0, compact.indexOf(':')))
  return compact
}

export function encodeLiteral(lit, prefixes, used) {
  const value = lit.value
  if (lit.language) return encodeStringValue(value) + '@' + lit.language
  const dt = lit.datatype.value
  switch (dt) {
    case XSD.string: return encodeStringValue(value)
    case XSD.boolean: if (value === 'true' || value === 'false') return value; break
    case XSD.integer: if (/^[+-]?\d+$/.test(value)) return value; break
    case XSD.decimal: if (/^[+-]?\d*\.\d+$/.test(value)) return value; break
    case XSD.double: if (/^[+-]?(?:\d+\.\d*|\.?\d+)[eE][+-]?\d+$/.test(value)) return value; break
  }
  return encodeStringValue(value) + '^^' + encodeIri(dt, prefixes, used)
}

export function encodeTerm(term, prefixes, used) {
  switch (term.termType) {
    case 'NamedNode': return encodeIri(term.value, prefixes, used)
    case 'BlankNode': return '_:' + term.value
    case 'Literal': return encodeLiteral(term, prefixes, used)
    default: return String(term.value)
  }
}

function encodePredicate(term, prefixes, used) {
  return term.termType === 'NamedNode' && term.value === RDF.type ? 'a' : encodeTerm(term, prefixes, used)
}

function prefixLine(prefix, ns, width) {
  return '@prefix ' + (prefix + ':').padEnd(width) + ' <' + escapeIri(ns) + '> .'
}

/** The prefixes the body actually needed, in declaration order. */
function prefixHeader(prefixes, used) {
  return Object.keys(prefixes).filter(p => used.has(p)).map(p => prefixLine(p, prefixes[p], 0))
}

/**
 * Every declared prefix, with the namespaces aligned in a column. A
 * namespace-only document has no triples to filter by, and listing its
 * declarations is its point.
 */
function prefixTable(prefixes) {
  const names = Object.keys(prefixes)
  const width = Math.max(0, ...names.map(p => p.length + 1))
  return names.map(p => prefixLine(p, prefixes[p], width))
}

/**
 * @param {{ quads: Array, prefixes: Object<string,string> }} parsed
 * @returns {string} the Turtle document
 */
export function toTurtle(parsed) {
  const quads = parsed.quads || []
  const allPrefixes = {}
  for (const p of Object.keys(parsed.prefixes || {})) {
    if (PN_PREFIX.test(p)) allPrefixes[p] = parsed.prefixes[p]
  }
  // Candidates only — the header ends up listing just the prefixes the output
  // truly needs (inlined lists never emit rdf:first/rest, native numbers skip xsd:).
  const prefixes = usedPrefixes(quads, allPrefixes, { validateLocal: validLocal })
  const used = new Set()
  const graph = analyze(quads)
  const consumed = new Set()

  function renderObject(term, depth) {
    if (!isBlankNode(term)) return encodeTerm(term, prefixes, used)
    const key = termKey(term)
    if (!graph.isInlinable(term) || consumed.has(key)) return encodeTerm(term, prefixes, used)
    const entry = graph.bySubject.get(key)
    if (!entry) { consumed.add(key); return '[]' }
    const items = graph.listItems(key)
    if (items) {
      for (const k of graph.listNodeKeys(key)) consumed.add(k)
      return '( ' + items.map(item => renderObject(item, depth)).join(' ') + ' )'
    }
    consumed.add(key)
    const pad = INDENT.repeat(depth + 1)
    return '[\n' + pad + renderProperties(entry.triples, depth + 1).join(' ;\n' + pad) + '\n' + INDENT.repeat(depth) + ']'
  }

  function renderProperties(triples, depth) {
    return groupByPredicate(triples).map(group =>
      encodePredicate(group.predicate, prefixes, used) + ' ' +
      group.objects.map(o => renderObject(o, depth)).join(', ')
    )
  }

  function renderSubject(entry) {
    consumed.add(entry.key)
    // top-level properties already sit one indent in, hence nested nodes begin at depth 1
    const props = renderProperties(entry.triples, 1)
    return encodeTerm(entry.term, prefixes, used) + ' ' + props.join(' ;\n' + INDENT) + ' .'
  }

  const blocks = []
  for (const entry of graph.subjects) {
    if (graph.isInlinable(entry.term)) continue
    blocks.push(renderSubject(entry))
  }
  // Blank nodes that could have been inlined but were never reached (cycles only)
  for (const entry of graph.subjects) {
    if (consumed.has(entry.key)) continue
    blocks.push(renderSubject(entry))
  }

  const header = quads.length ? prefixHeader(prefixes, used) : prefixTable(allPrefixes)
  const parts = []
  if (header.length) parts.push(header.join('\n'))
  if (blocks.length) parts.push(blocks.join('\n\n'))
  return parts.join('\n\n') + (parts.length ? '\n' : '')
}
