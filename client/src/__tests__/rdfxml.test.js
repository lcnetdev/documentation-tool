import { describe, it, expect } from 'vitest'
import { parseRdfXml, prepareRdfXml, RdfXmlError } from '@/utils/rdf/rdfxml'
import { looksLikeRdfXml } from '@/utils/rdf/detect'
import { formatEmptyRdfXml, parseEmptyRdfRoot } from '@/utils/rdf/emptyRoot'
import { RDF, XSD, RDF_NS } from '@/utils/rdf/terms'

const FOAF = 'http://xmlns.com/foaf/0.1/'
const EX = 'http://example.org/'
const BF = 'http://id.loc.gov/ontologies/bibframe/'

function withPredicate(parsed, predicate) {
  return parsed.quads.filter(q => q.predicate.value === predicate)
}

function asTriples(parsed) {
  return parsed.quads.map(q => [q.subject.value, q.predicate.value, q.object.value])
}

describe('parseRdfXml', () => {
  it('parses typed nodes, literals and resource references', () => {
    const parsed = parseRdfXml(`
      <rdf:RDF xmlns:rdf="${RDF_NS}" xmlns:foaf="${FOAF}">
        <foaf:Person rdf:about="${EX}alice">
          <foaf:name>Alice</foaf:name>
          <foaf:knows rdf:resource="${EX}bob"/>
        </foaf:Person>
      </rdf:RDF>`)
    expect(asTriples(parsed)).toEqual([
      [EX + 'alice', RDF.type, FOAF + 'Person'],
      [EX + 'alice', FOAF + 'name', 'Alice'],
      [EX + 'alice', FOAF + 'knows', EX + 'bob']
    ])
    expect(parsed.quads[1].object.datatype.value).toBe(XSD.string)
    expect(parsed.quads[2].object.termType).toBe('NamedNode')
    expect(parsed.prefixes).toEqual({ rdf: RDF_NS, foaf: FOAF })
    expect(parsed.warnings).toEqual([])
  })

  it('handles rdf:Description with property attributes and rdf:type attribute', () => {
    const parsed = parseRdfXml(`
      <rdf:RDF xmlns:rdf="${RDF_NS}" xmlns:foaf="${FOAF}">
        <rdf:Description rdf:about="${EX}alice" foaf:name="Alice" rdf:type="${FOAF}Person"/>
      </rdf:RDF>`)
    const triples = asTriples(parsed)
    expect(triples).toContainEqual([EX + 'alice', FOAF + 'name', 'Alice'])
    expect(triples).toContainEqual([EX + 'alice', RDF.type, FOAF + 'Person'])
    expect(triples).toHaveLength(2)
  })

  it('creates blank nodes for nested node elements without rdf:about', () => {
    const parsed = parseRdfXml(`
      <rdf:RDF xmlns:rdf="${RDF_NS}" xmlns:foaf="${FOAF}">
        <foaf:Person rdf:about="${EX}alice">
          <foaf:knows><foaf:Person><foaf:name>Bob</foaf:name></foaf:Person></foaf:knows>
        </foaf:Person>
      </rdf:RDF>`)
    const knows = withPredicate(parsed, FOAF + 'knows')[0]
    expect(knows.object.termType).toBe('BlankNode')
    const bob = parsed.quads.filter(q => q.subject.termType === 'BlankNode')
    expect(bob.map(q => q.predicate.value)).toEqual([RDF.type, FOAF + 'name'])
  })

  it('applies xml:lang inheritance and rdf:datatype', () => {
    const parsed = parseRdfXml(`
      <rdf:RDF xmlns:rdf="${RDF_NS}" xmlns:ex="${EX}" xml:lang="en">
        <rdf:Description rdf:about="${EX}a">
          <ex:label>Hello</ex:label>
          <ex:label xml:lang="fr">Bonjour</ex:label>
          <ex:label xml:lang="">plain</ex:label>
          <ex:count rdf:datatype="${XSD.integer}">42</ex:count>
        </rdf:Description>
      </rdf:RDF>`)
    const labels = withPredicate(parsed, EX + 'label').map(q => q.object)
    expect(labels[0].language).toBe('en')
    expect(labels[0].datatype.value).toBe(RDF.langString)
    expect(labels[1].language).toBe('fr')
    expect(labels[2].language).toBe('')
    expect(labels[2].datatype.value).toBe(XSD.string)
    const count = withPredicate(parsed, EX + 'count')[0].object
    expect(count.value).toBe('42')
    expect(count.datatype.value).toBe(XSD.integer)
    expect(parsed.prefixes.xsd).toBe('http://www.w3.org/2001/XMLSchema#')
  })

  it('supports rdf:parseType Resource, Collection and Literal', () => {
    const parsed = parseRdfXml(`
      <rdf:RDF xmlns:rdf="${RDF_NS}" xmlns:ex="${EX}">
        <rdf:Description rdf:about="${EX}a">
          <ex:addr rdf:parseType="Resource"><ex:city>Paris</ex:city></ex:addr>
          <ex:list rdf:parseType="Collection">
            <rdf:Description rdf:about="${EX}x"/>
            <rdf:Description rdf:about="${EX}y"/>
          </ex:list>
          <ex:empty rdf:parseType="Collection"/>
          <ex:html rdf:parseType="Literal"><b xmlns="http://www.w3.org/1999/xhtml">bold</b> text</ex:html>
        </rdf:Description>
      </rdf:RDF>`)
    const addr = withPredicate(parsed, EX + 'addr')[0].object
    expect(addr.termType).toBe('BlankNode')
    expect(asTriples(parsed)).toContainEqual([addr.value, EX + 'city', 'Paris'])

    const head = withPredicate(parsed, EX + 'list')[0].object
    expect(head.termType).toBe('BlankNode')
    const firsts = withPredicate(parsed, RDF.first).map(q => q.object.value)
    expect(firsts).toEqual([EX + 'x', EX + 'y'])
    const rests = withPredicate(parsed, RDF.rest).map(q => q.object)
    expect(rests[0].termType).toBe('BlankNode')
    expect(rests[1].value).toBe(RDF.nil)

    expect(withPredicate(parsed, EX + 'empty')[0].object.value).toBe(RDF.nil)

    const html = withPredicate(parsed, EX + 'html')[0].object
    expect(html.datatype.value).toBe(RDF.XMLLiteral)
    expect(html.value).toContain('bold</b> text')
  })

  it('numbers rdf:li members per container', () => {
    const parsed = parseRdfXml(`
      <rdf:RDF xmlns:rdf="${RDF_NS}" xmlns:ex="${EX}">
        <rdf:Description rdf:about="${EX}a">
          <ex:members><rdf:Bag><rdf:li>one</rdf:li><rdf:li>two</rdf:li></rdf:Bag></ex:members>
        </rdf:Description>
      </rdf:RDF>`)
    const preds = parsed.quads.map(q => q.predicate.value)
    expect(preds).toContain(RDF_NS + '_1')
    expect(preds).toContain(RDF_NS + '_2')
    expect(preds).not.toContain(RDF_NS + 'li')
  })

  it('resolves rdf:ID and relative rdf:about against xml:base and shares rdf:nodeID', () => {
    const parsed = parseRdfXml(`
      <rdf:RDF xmlns:rdf="${RDF_NS}" xmlns:ex="${EX}" xml:base="http://example.org/doc">
        <rdf:Description rdf:ID="frag"><ex:p rdf:resource="other"/></rdf:Description>
        <rdf:Description rdf:nodeID="n1"><ex:q>1</ex:q></rdf:Description>
        <rdf:Description rdf:about="#frag"><ex:r rdf:nodeID="n1"/></rdf:Description>
      </rdf:RDF>`)
    const triples = asTriples(parsed)
    expect(triples[0]).toEqual(['http://example.org/doc#frag', EX + 'p', 'http://example.org/other'])
    const r = withPredicate(parsed, EX + 'r')[0]
    expect(r.subject.value).toBe('http://example.org/doc#frag')
    expect(r.object.termType).toBe('BlankNode')
    expect(r.object.value).toBe(withPredicate(parsed, EX + 'q')[0].subject.value)
  })

  it('reifies statements when a property element carries rdf:ID', () => {
    const parsed = parseRdfXml(`
      <rdf:RDF xmlns:rdf="${RDF_NS}" xmlns:ex="${EX}" xml:base="http://example.org/doc">
        <rdf:Description rdf:about="${EX}a"><ex:p rdf:ID="s1">v</ex:p></rdf:Description>
      </rdf:RDF>`)
    const triples = asTriples(parsed)
    expect(triples).toContainEqual(['http://example.org/doc#s1', RDF.type, RDF.Statement])
    expect(triples).toContainEqual(['http://example.org/doc#s1', RDF.subject, EX + 'a'])
    expect(triples).toContainEqual(['http://example.org/doc#s1', RDF.predicate, EX + 'p'])
    expect(triples).toContainEqual(['http://example.org/doc#s1', RDF.object, 'v'])
  })

  it('accepts an empty property element with property attributes as a blank node', () => {
    const parsed = parseRdfXml(`
      <rdf:RDF xmlns:rdf="${RDF_NS}" xmlns:ex="${EX}">
        <rdf:Description rdf:about="${EX}a"><ex:p ex:x="1" ex:y="2"/><ex:e/></rdf:Description>
      </rdf:RDF>`)
    const p = withPredicate(parsed, EX + 'p')[0].object
    expect(p.termType).toBe('BlankNode')
    expect(asTriples(parsed)).toContainEqual([p.value, EX + 'x', '1'])
    const e = withPredicate(parsed, EX + 'e')[0].object
    expect(e.termType).toBe('Literal')
    expect(e.value).toBe('')
  })

  it('parses a BIBFRAME fragment with no root and no namespace declarations', () => {
    const parsed = parseRdfXml(`
<bf:Hub rdf:about="http://id.loc.gov/resources/hubs/4978">
  <bflc:aap>Homer. Odyssey. English</bflc:aap>
  <bf:contribution>
    <bf:Contribution>
      <rdf:type rdf:resource="http://id.loc.gov/ontologies/bibframe/PrimaryContribution"/>
      <bf:agent rdf:resource="http://id.loc.gov/rwo/agents/n78095639"/>
    </bf:Contribution>
  </bf:contribution>
</bf:Hub>`)
    expect(parsed.warnings).toEqual([])
    expect(parsed.prefixes.bf).toBe(BF)
    expect(parsed.prefixes.bflc).toBe('http://id.loc.gov/ontologies/bflc/')
    const triples = asTriples(parsed)
    expect(triples[0]).toEqual(['http://id.loc.gov/resources/hubs/4978', RDF.type, BF + 'Hub'])
    expect(triples).toContainEqual(['http://id.loc.gov/resources/hubs/4978', 'http://id.loc.gov/ontologies/bflc/aap', 'Homer. Odyssey. English'])
    const contribution = withPredicate(parsed, BF + 'contribution')[0].object
    expect(withPredicate(parsed, RDF.type).map(q => q.object.value)).toContain(BF + 'PrimaryContribution')
    expect(contribution.termType).toBe('BlankNode')
    expect(parsed.quads).toHaveLength(6)
  })

  it('injects declarations into an existing rdf:RDF root that lacks them', () => {
    const parsed = parseRdfXml(`<rdf:RDF>
  <bf:Work><bf:title><bf:Title><bf:mainTitle xml:lang="fr">Le Prince</bf:mainTitle></bf:Title></bf:title></bf:Work>
</rdf:RDF>`)
    expect(parsed.warnings).toEqual([])
    expect(parsed.quads).toHaveLength(4)
    expect(withPredicate(parsed, BF + 'mainTitle')[0].object.language).toBe('fr')
  })

  it('warns about unknown undeclared prefixes but still parses', () => {
    const parsed = parseRdfXml(`<zzz:Thing rdf:about="${EX}t"><zzz:p>v</zzz:p></zzz:Thing>`)
    expect(parsed.warnings).toHaveLength(1)
    expect(parsed.warnings[0]).toMatch(/"zzz" is not declared/)
    expect(parsed.quads[0].object.value).toBe('http://undeclared.example/zzz#Thing')
  })

  it('handles a self-closing rdf:RDF with only namespace declarations', () => {
    const parsed = parseRdfXml(`<rdf:RDF xmlns:rdf="${RDF_NS}" xmlns:bf="${BF}" />`)
    expect(parsed.quads).toEqual([])
    expect(parsed.prefixes.bf).toBe(BF)
  })

  it('throws RdfXmlError with a location for malformed XML', () => {
    let error
    try {
      parseRdfXml(`<rdf:RDF>\n  <bf:Work>\n    <bf:title>oops</bf:Work>\n</rdf:RDF>`)
    } catch (err) {
      error = err
    }
    expect(error).toBeInstanceOf(RdfXmlError)
    expect(error.message).toMatch(/^Line \d+/)
  })

  it('strips the XML declaration and keeps line numbers in errors', () => {
    let error
    try {
      parseRdfXml(`<?xml version="1.0"?>\n<rdf:RDF>\n<bf:Work>\n</rdf:RDF>`)
    } catch (err) {
      error = err
    }
    expect(error).toBeInstanceOf(RdfXmlError)
    expect(error.line).toBeGreaterThanOrEqual(3)
  })
})

describe('prepareRdfXml', () => {
  it('wraps fragments and declares well-known prefixes', () => {
    const result = prepareRdfXml('<bf:Work rdf:about="x"/>')
    expect(result.wrapped).toBe(true)
    expect(result.xml.startsWith('<rdf:RDF ')).toBe(true)
    expect(result.xml).toContain(`xmlns:bf="${BF}"`)
    expect(result.xml).toContain(`xmlns:rdf="${RDF_NS}"`)
    expect(result.injectedPrefixes).toEqual({ bf: BF, rdf: RDF_NS })
  })

  it('leaves complete documents alone', () => {
    const doc = `<rdf:RDF xmlns:rdf="${RDF_NS}"><rdf:Description rdf:about="x"/></rdf:RDF>`
    const result = prepareRdfXml(doc)
    expect(result.wrapped).toBe(false)
    expect(result.xml).toBe(doc)
  })
})

describe('looksLikeRdfXml', () => {
  it('recognises explicit RDF fence languages', () => {
    expect(looksLikeRdfXml('rdfxml', '')).toBe(true)
    expect(looksLikeRdfXml('rdf', '')).toBe(true)
    expect(looksLikeRdfXml('RDF/XML', '')).toBe(true)
  })

  it('recognises xml and untagged blocks containing RDF syntax', () => {
    expect(looksLikeRdfXml('xml', '<bf:Hub rdf:about="http://x"/>')).toBe(true)
    expect(looksLikeRdfXml('xml', '<rdf:RDF>\n</rdf:RDF>')).toBe(true)
    expect(looksLikeRdfXml('', '<rdf:Description rdf:about="x"/>')).toBe(true)
    expect(looksLikeRdfXml('xml', `<r:RDF xmlns:r="${RDF_NS}"/>`)).toBe(true)
  })

  it('rejects other xml and other languages', () => {
    expect(looksLikeRdfXml('xml', '<record><leader>x</leader></record>')).toBe(false)
    expect(looksLikeRdfXml('xml', '<p>rdf:about is an attribute</p>')).toBe(false)
    expect(looksLikeRdfXml('python', 'print("<rdf:RDF>")')).toBe(false)
    expect(looksLikeRdfXml('', 'plain text')).toBe(false)
  })
})

describe('formatEmptyRdfXml', () => {
  const NAMESPACES = `<rdf:RDF\n    xmlns:rdf="${RDF_NS}" xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#" xmlns:bf="${BF}"\n    />\n`

  it('puts each declaration of a namespace-only root on its own line', () => {
    expect(formatEmptyRdfXml(NAMESPACES)).toBe(
      `<rdf:RDF\n    xmlns:rdf="${RDF_NS}"\n    xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"\n    xmlns:bf="${BF}"\n/>`
    )
  })

  it('keeps an explicit closing tag, other prefixes and single-quoted values', () => {
    const source = `<?xml version="1.0"?>\n<r:RDF xmlns:r='${RDF_NS}' xml:base="http://x/"></r:RDF>`
    expect(parseEmptyRdfRoot(source)).toEqual({
      prefix: 'r',
      attributes: [{ name: 'xmlns:r', value: RDF_NS }, { name: 'xml:base', value: 'http://x/' }],
      selfClosing: false
    })
    expect(formatEmptyRdfXml(source)).toBe(`<r:RDF\n    xmlns:r="${RDF_NS}"\n    xml:base="http://x/"\n>\n</r:RDF>`)
  })

  it('leaves documents with content, fragments and bare roots alone', () => {
    expect(formatEmptyRdfXml(`<rdf:RDF xmlns:rdf="${RDF_NS}"><bf:Work/></rdf:RDF>`)).toBeNull()
    expect(formatEmptyRdfXml(`<rdf:RDF xmlns:rdf="${RDF_NS}">\n  <!-- soon -->\n</rdf:RDF>`)).toBeNull()
    expect(formatEmptyRdfXml('<bf:Work rdf:about="http://x/1"/>')).toBeNull()
    expect(formatEmptyRdfXml('<rdf:RDF/>')).toBeNull()
    expect(formatEmptyRdfXml('')).toBeNull()
    expect(parseEmptyRdfRoot('<bf:Work rdf:about="http://x/1"/>')).toBeNull()
  })
})
