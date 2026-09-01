import { describe, it, expect } from 'vitest'
import { parseRdfXml } from '@/utils/rdf/rdfxml'
import { toTurtle } from '@/utils/rdf/turtle'
import { toJsonLd } from '@/utils/rdf/jsonld'
import { buildGraph, layoutGraph, edgePath } from '@/utils/rdf/graph'
import { RDF_NS, XSD_NS, compactIri, namedNode, blankNode, literal, quad } from '@/utils/rdf/terms'

const FOAF = 'http://xmlns.com/foaf/0.1/'
const EX = 'http://example.org/'

const SAMPLE = `
<rdf:RDF xmlns:rdf="${RDF_NS}" xmlns:foaf="${FOAF}" xmlns:ex="${EX}" xmlns:unused="http://unused.example/">
  <foaf:Person rdf:about="${EX}alice">
    <foaf:name xml:lang="en">Alice</foaf:name>
    <foaf:age rdf:datatype="${XSD_NS}integer">30</foaf:age>
    <ex:active rdf:datatype="${XSD_NS}boolean">true</ex:active>
    <foaf:knows rdf:resource="${EX}bob"/>
    <foaf:knows>
      <foaf:Person>
        <foaf:name>Carol "C" Smith</foaf:name>
      </foaf:Person>
    </foaf:knows>
    <ex:tags rdf:parseType="Collection">
      <rdf:Description rdf:about="${EX}t1"/>
      <rdf:Description rdf:about="${EX}t2"/>
    </ex:tags>
    <ex:odd rdf:resource="http://other.example/path/with/slashes"/>
  </foaf:Person>
</rdf:RDF>`

describe('toTurtle', () => {
  const turtle = toTurtle(parseRdfXml(SAMPLE))

  it('declares only the prefixes that are used', () => {
    expect(turtle).toContain(`@prefix foaf: <${FOAF}> .`)
    expect(turtle).toContain(`@prefix ex: <${EX}> .`)
    expect(turtle).not.toContain('unused')
    expect(turtle).not.toContain('@prefix rdf:')
  })

  it('uses "a" for rdf:type and groups predicates with ;', () => {
    expect(turtle).toContain('ex:alice a foaf:Person ;')
    expect(turtle).toContain('    foaf:name "Alice"@en ;')
  })

  it('writes numeric and boolean shorthand', () => {
    expect(turtle).toContain('foaf:age 30')
    expect(turtle).toContain('ex:active true')
  })

  it('nests single-use blank nodes and escapes quotes', () => {
    expect(turtle).toContain('foaf:knows ex:bob, [\n        a foaf:Person ;\n        foaf:name "Carol \\"C\\" Smith"\n    ]')
    expect(turtle).not.toContain('_:')
  })

  it('renders collections with parentheses', () => {
    expect(turtle).toContain('ex:tags ( ex:t1 ex:t2 )')
  })

  it('falls back to full IRIs when the local part is not a valid prefixed name', () => {
    expect(turtle).toContain('<http://other.example/path/with/slashes>')
  })

  it('writes shared blank nodes with labels', () => {
    const shared = toTurtle({
      prefixes: { ex: EX },
      quads: [
        quad(namedNode(EX + 'a'), namedNode(EX + 'p'), blankNode('b0')),
        quad(namedNode(EX + 'b'), namedNode(EX + 'p'), blankNode('b0')),
        quad(blankNode('b0'), namedNode(EX + 'v'), literal('x'))
      ]
    })
    expect(shared).toContain('ex:a ex:p _:b0 .')
    expect(shared).toContain('_:b0 ex:v "x" .')
  })

  it('uses triple quotes for multi-line strings', () => {
    const out = toTurtle({ prefixes: {}, quads: [quad(namedNode(EX + 'a'), namedNode(EX + 'p'), literal('line1\nline2'))] })
    expect(out).toContain('"""line1\nline2"""')
  })
})

describe('toJsonLd', () => {
  const doc = toJsonLd(parseRdfXml(SAMPLE))

  it('builds a context from used prefixes and compacts IRIs', () => {
    expect(doc['@context']).toEqual({ foaf: FOAF, ex: EX })
    expect(doc['@id']).toBe('ex:alice')
    expect(doc['@type']).toBe('foaf:Person')
  })

  it('emits language and native values', () => {
    expect(doc['foaf:name']).toEqual({ '@value': 'Alice', '@language': 'en' })
    expect(doc['foaf:age']).toBe(30)
    expect(doc['ex:active']).toBe(true)
  })

  it('embeds single-use blank nodes and lists', () => {
    expect(doc['foaf:knows']).toEqual([
      { '@id': 'ex:bob' },
      { '@type': 'foaf:Person', 'foaf:name': 'Carol "C" Smith' }
    ])
    expect(doc['ex:tags']).toEqual({ '@list': [{ '@id': 'ex:t1' }, { '@id': 'ex:t2' }] })
  })

  it('uses @graph for multiple top-level nodes', () => {
    const multi = toJsonLd({
      prefixes: { ex: EX },
      quads: [
        quad(namedNode(EX + 'a'), namedNode(EX + 'p'), literal('1')),
        quad(namedNode(EX + 'b'), namedNode(EX + 'p'), literal('2'))
      ]
    })
    expect(multi['@graph']).toHaveLength(2)
    expect(multi['@graph'][1]).toEqual({ '@id': 'ex:b', 'ex:p': '2' })
  })

  it('keeps typed literals it cannot convert natively', () => {
    const typed = toJsonLd({
      prefixes: { ex: EX, xsd: XSD_NS },
      quads: [quad(namedNode(EX + 'a'), namedNode(EX + 'd'), literal('2024-01-01', namedNode(XSD_NS + 'date')))]
    })
    expect(typed['ex:d']).toEqual({ '@value': '2024-01-01', '@type': 'xsd:date' })
  })
})

describe('graph model', () => {
  const parsed = parseRdfXml(SAMPLE)
  const graph = buildGraph(parsed)

  it('merges resources and keeps every literal as its own node', () => {
    const literals = graph.nodes.filter(n => n.kind === 'literal')
    expect(literals).toHaveLength(4)
    expect(graph.nodes.filter(n => n.label === 'ex:alice')).toHaveLength(1)
    expect(graph.edges).toHaveLength(parsed.quads.length)
  })

  it('labels nodes and edges with compact IRIs and marks classes', () => {
    const person = graph.nodes.find(n => n.label === 'foaf:Person')
    expect(person.isClass).toBe(true)
    const typeEdge = graph.edges.find(e => e.kind === 'type')
    expect(typeEdge.label).toBe('rdf:type')
    const name = graph.nodes.find(n => n.label === '"Alice"')
    expect(name.sublabel).toBe('@en')
    const age = graph.nodes.find(n => n.label === '"30"')
    expect(age.sublabel).toBe('^^xsd:integer')
    expect(graph.nodes.find(n => n.kind === 'blank').label).toMatch(/^_:b/)
  })

  it('lays out every node and edge with dagre', () => {
    const layout = layoutGraph(graph, { rankdir: 'LR' })
    expect(layout.width).toBeGreaterThan(0)
    expect(layout.height).toBeGreaterThan(0)
    for (const node of layout.nodes) {
      expect(Number.isFinite(node.x)).toBe(true)
      expect(node.width).toBeGreaterThan(0)
    }
    for (const edge of layout.edges) {
      expect(edge.points.length).toBeGreaterThan(1)
      expect(edgePath(edge.points)).toMatch(/^M/)
    }
  })
})

describe('compactIri', () => {
  it('prefers the longest matching namespace', () => {
    const prefixes = { a: 'http://x/', b: 'http://x/y/' }
    expect(compactIri('http://x/y/z', prefixes)).toBe('b:z')
    expect(compactIri('http://x/q', prefixes)).toBe('a:q')
    expect(compactIri('http://x/', prefixes)).toBeNull()
    expect(compactIri('http://other/', prefixes)).toBeNull()
  })
})
