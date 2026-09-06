/**
 * Serializes quads to JSON-LD. The output is compacted, with an @context
 * limited to the prefixes in play; blank nodes referenced once are embedded
 * inline and well-formed lists come out as @list arrays.
 */

import { RDF, XSD, compactIri, usedPrefixes, termKey } from './terms'
import { analyze, groupByPredicate } from './structure'

const COMPACT_OPTIONS = { allowEmptyPrefix: false }

function nativeValue(lit) {
  const v = lit.value
  switch (lit.datatype.value) {
    case XSD.boolean:
      if (v === 'true') return true
      if (v === 'false') return false
      return undefined
    case XSD.integer:
      if (/^[+-]?\d+$/.test(v) && Number.isSafeInteger(Number(v))) return Number(v)
      return undefined
    case XSD.double:
      if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(v) && Number.isFinite(Number(v))) return Number(v)
      return undefined
    default:
      return undefined
  }
}

/**
 * @param {{ quads: Array, prefixes: Object<string,string> }} parsed
 * @returns {object} the JSON-LD document (JSON.stringify it to print)
 */
export function toJsonLd(parsed) {
  const quads = parsed.quads || []
  const declared = parsed.prefixes || {}
  const prefixes = usedPrefixes(quads, declared, COMPACT_OPTIONS)
  const used = new Set()
  const graph = analyze(quads)
  const consumed = new Set()

  function iri(value) {
    const compact = compactIri(value, prefixes, COMPACT_OPTIONS)
    if (compact === null) return value
    used.add(compact.slice(0, compact.indexOf(':')))
    return compact
  }

  function literalValue(lit) {
    if (lit.language) return { '@value': lit.value, '@language': lit.language }
    if (lit.datatype.value === XSD.string) return lit.value
    const native = nativeValue(lit)
    if (native !== undefined) return native
    return { '@value': lit.value, '@type': iri(lit.datatype.value) }
  }

  function objectValue(term) {
    if (term.termType === 'Literal') return literalValue(term)
    if (term.termType === 'NamedNode') {
      if (term.value === RDF.nil) return { '@list': [] }
      return { '@id': iri(term.value) }
    }
    const key = termKey(term)
    if (graph.isInlinable(term) && !consumed.has(key)) {
      const items = graph.listItems(key)
      if (items) {
        for (const k of graph.listNodeKeys(key)) consumed.add(k)
        return { '@list': items.map(objectValue) }
      }
      const entry = graph.bySubject.get(key)
      consumed.add(key)
      return entry ? nodeObject(entry, false) : {}
    }
    return { '@id': '_:' + term.value }
  }

  function nodeObject(entry, withId) {
    consumed.add(entry.key)
    const node = {}
    if (withId) node['@id'] = entry.term.termType === 'BlankNode' ? '_:' + entry.term.value : iri(entry.term.value)
    for (const group of groupByPredicate(entry.triples)) {
      if (group.predicate.value === RDF.type) {
        const types = group.objects.map(o => o.termType === 'NamedNode' ? iri(o.value) : objectValue(o))
        node['@type'] = types.length === 1 ? types[0] : types
        continue
      }
      const key = iri(group.predicate.value)
      const values = group.objects.map(objectValue)
      const value = values.length === 1 ? values[0] : values
      node[key] = key in node ? [].concat(node[key], value) : value
    }
    return node
  }

  const nodes = []
  for (const entry of graph.subjects) {
    if (graph.isInlinable(entry.term)) continue
    nodes.push(nodeObject(entry, true))
  }
  for (const entry of graph.subjects) {
    if (consumed.has(entry.key)) continue
    nodes.push(nodeObject(entry, true))
  }

  const doc = {}
  const context = {}
  if (quads.length) {
    for (const p of Object.keys(prefixes)) {
      if (used.has(p)) context[p] = prefixes[p]
    }
  } else {
    // A namespace-only document has nothing to compact; its context carries
    // every declared prefix instead, since introducing them is its point.
    // The default namespace is left out: '' is not a valid JSON-LD term.
    for (const p of Object.keys(declared)) {
      if (p !== '') context[p] = declared[p]
    }
  }
  if (Object.keys(context).length) doc['@context'] = context
  if (nodes.length === 1) Object.assign(doc, nodes[0])
  else doc['@graph'] = nodes
  return doc
}

export function toJsonLdString(parsed) {
  return JSON.stringify(toJsonLd(parsed), null, 2)
}
