/**
 * Graph analysis shared by the serializers: bundles quads by subject, tallies
 * references to each blank node, and spots well-formed RDF lists — letting
 * single-use blank nodes nest ([ ... ] / embedded objects) and lists print
 * as ( ... ) / @list.
 */

import { RDF, termKey, isBlankNode } from './terms'

export function analyze(quads) {
  const bySubject = new Map()
  const subjects = []
  const objectRefs = new Map()

  for (const q of quads) {
    const key = termKey(q.subject)
    let entry = bySubject.get(key)
    if (!entry) {
      entry = { key, term: q.subject, triples: [] }
      bySubject.set(key, entry)
      subjects.push(entry)
    }
    entry.triples.push(q)
    if (isBlankNode(q.object)) {
      const okey = termKey(q.object)
      objectRefs.set(okey, (objectRefs.get(okey) || 0) + 1)
    }
  }

  const listCache = new Map()

  /** The items of a well-formed list starting at `key`; null otherwise. */
  function listItems(key) {
    if (listCache.has(key)) return listCache.get(key)
    listCache.set(key, null) // breaks cycles
    const items = []
    let current = key
    const seen = new Set()
    for (;;) {
      if (seen.has(current)) return null
      seen.add(current)
      const entry = bySubject.get(current)
      if (!entry || entry.triples.length !== 2 || !isBlankNode(entry.term)) return null
      const first = entry.triples.find(t => t.predicate.value === RDF.first)
      const rest = entry.triples.find(t => t.predicate.value === RDF.rest)
      if (!first || !rest) return null
      if (current !== key && (objectRefs.get(current) || 0) !== 1) return null
      items.push(first.object)
      if (rest.object.termType === 'NamedNode' && rest.object.value === RDF.nil) break
      if (!isBlankNode(rest.object)) return null
      current = termKey(rest.object)
    }
    listCache.set(key, items)
    return items
  }

  /** Every node key belonging to the well-formed list from `key` on. */
  function listNodeKeys(key) {
    const keys = []
    let current = key
    while (current) {
      keys.push(current)
      const entry = bySubject.get(current)
      const rest = entry.triples.find(t => t.predicate.value === RDF.rest)
      current = isBlankNode(rest.object) ? termKey(rest.object) : null
    }
    return keys
  }

  function isInlinable(term) {
    return isBlankNode(term) && (objectRefs.get(termKey(term)) || 0) === 1
  }

  return { subjects, bySubject, objectRefs, listItems, listNodeKeys, isInlinable }
}

/** Bunch a subject's triples under their predicates (in order of appearance), rdf:type leading. */
export function groupByPredicate(triples) {
  const groups = new Map()
  for (const t of triples) {
    const key = termKey(t.predicate)
    if (!groups.has(key)) groups.set(key, { predicate: t.predicate, objects: [] })
    groups.get(key).objects.push(t.object)
  }
  const list = Array.from(groups.values())
  list.sort((a, b) => (b.predicate.value === RDF.type) - (a.predicate.value === RDF.type))
  return list
}
