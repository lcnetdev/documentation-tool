/**
 * An RDF/XML parser on top of the browser's DOMParser (jsdom works as well).
 *
 * Covers the RDF/XML grammar (W3C RDF 1.1 XML Syntax, section 7): node
 * elements, property elements, property attributes, rdf:about / rdf:ID /
 * rdf:nodeID / rdf:resource, rdf:datatype, xml:lang, xml:base,
 * rdf:parseType="Resource" | "Collection" | "Literal", rdf:li, plus
 * reification through rdf:ID on property elements.
 *
 * Snippets in documentation are usually fragments — no rdf:RDF root, no
 * xmlns declarations. `prepareRdfXml` patches that up before we parse.
 */

import {
  RDF, RDF_NS, XML_NS, XMLNS_NS, WELL_KNOWN_PREFIXES,
  namedNode, blankNode, literal, quad, withStandardPrefixes
} from './terms'

export class RdfXmlError extends Error {
  constructor(message, line, column) {
    super(message)
    this.name = 'RdfXmlError'
    this.line = line
    this.column = column
  }
}

// rdf: attributes that belong to the grammar itself, never treated as property attributes
const CORE_SYNTAX_TERMS = new Set(['RDF', 'ID', 'about', 'parseType', 'resource', 'nodeID', 'datatype'])
// rdf:li plus the attributes RDF 1.1 dropped from the language
const NOT_PROPERTY_ATTRS = new Set([...CORE_SYNTAX_TERMS, 'li', 'Description', 'aboutEach', 'aboutEachPrefix', 'bagID'])

const NAME = '[A-Za-z_][\\w.-]*'

/**
 * Turns a snippet into a complete RDF/XML document:
 *  - drops any XML declaration at the top
 *  - wraps bare fragments (no rdf:RDF root) in <rdf:RDF>
 *  - adds declarations for prefixes in use but undeclared, pulling
 *    namespaces from the well-known table
 *
 * @returns {{ xml: string, warnings: string[], injectedPrefixes: Object<string,string>, wrapped: boolean, lineOffset: number }}
 */
export function prepareRdfXml(text) {
  const warnings = []
  let src = String(text == null ? '' : text)
  let lineOffset = 0
  const lead = /^\uFEFF?\s*(?:<\?xml[^>]*\?>\s*)?/.exec(src)
  if (lead && lead[0]) {
    lineOffset = (lead[0].match(/\n/g) || []).length
    src = src.slice(lead[0].length)
  }
  src = src.trimEnd()

  // Every prefix the text declares
  const declared = new Map()
  const declRe = new RegExp('xmlns:(' + NAME + ')\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')', 'g')
  let m
  while ((m = declRe.exec(src)) !== null) declared.set(m[1], m[2] != null ? m[2] : m[3])

  // Prefixes that element and attribute names rely on (search inside tags only)
  const used = new Set()
  const tagRe = new RegExp('<\\/?(' + NAME + '):' + NAME + '(?:\\s[^>]*)?>', 'g')
  const attrRe = new RegExp('\\s(' + NAME + '):' + NAME + '\\s*=', 'g')
  while ((m = tagRe.exec(src)) !== null) {
    used.add(m[1])
    let a
    while ((a = attrRe.exec(m[0])) !== null) used.add(a[1])
  }
  used.delete('xml')
  used.delete('xmlns')

  const rootMatch = new RegExp('^(?:<!--[\\s\\S]*?-->\\s*)*<(' + NAME + '):RDF(?=[\\s/>])').exec(src)
  const hasRdfRoot = !!rootMatch && (declared.has(rootMatch[1])
    ? declared.get(rootMatch[1]) === RDF_NS
    : rootMatch[1] === 'rdf')

  const injectedPrefixes = {}
  const decls = []
  for (const prefix of used) {
    if (declared.has(prefix)) continue
    let ns = WELL_KNOWN_PREFIXES[prefix]
    if (!ns) {
      ns = 'http://undeclared.example/' + prefix + '#'
      warnings.push('Namespace prefix "' + prefix + '" is not declared and is not a well-known prefix; using placeholder namespace <' + ns + '>.')
    }
    injectedPrefixes[prefix] = ns
    decls.push('xmlns:' + prefix + '="' + ns + '"')
  }

  let xml
  if (!hasRdfRoot) {
    if (!('rdf' in injectedPrefixes)) decls.unshift('xmlns:rdf="' + RDF_NS + '"')
    xml = '<rdf:RDF ' + decls.join(' ') + '>' + src + '</rdf:RDF>'
  } else if (decls.length) {
    xml = src.replace(new RegExp('^((?:<!--[\\s\\S]*?-->\\s*)*<' + NAME + ':RDF)'), '$1 ' + decls.join(' '))
  } else {
    xml = src
  }
  return { xml, warnings, injectedPrefixes, wrapped: !hasRdfRoot, lineOffset }
}

function describeParseError(errorEl, lineOffset) {
  const text = (errorEl.textContent || '').trim()
  let line = null, column = null, message = text
  let m
  if ((m = /line (\d+) at column (\d+): ([^\n]*)/.exec(text))) {
    // libxml2 as used by Chrome and Safari: "error on line 2 at column 10: Opening and ending tag mismatch..."
    line = +m[1]; column = +m[2]; message = m[3]
  } else if ((m = /Line Number (\d+), Column (\d+)/.exec(text))) {
    // Firefox reports: "XML Parsing Error: mismatched tag...\nLocation: ...\nLine Number 2, Column 10:"
    line = +m[1]; column = +m[2]; message = text.split('\n')[0].replace(/^XML Parsing Error:\s*/, '')
  } else if ((m = /^(\d+):(\d+): (.*)$/m.exec(text))) {
    // saxes via jsdom: "2:10: unexpected close tag."
    line = +m[1]; column = +m[2]; message = m[3]
  } else {
    message = text.split('\n')[0]
  }
  message = message.replace(/\s*Below is a rendering of the page.*$/s, '').trim() || 'Malformed XML'
  if (line != null) line += lineOffset
  const where = line != null ? 'Line ' + line + (column != null ? ', column ' + column : '') + ': ' : ''
  return new RdfXmlError(where + message, line, column)
}

function elementChildren(node) {
  const out = []
  for (const child of node.childNodes) {
    if (child.nodeType === 1) out.push(child)
  }
  return out
}

function isRdf(el, local) {
  return el.namespaceURI === RDF_NS && el.localName === local
}

function rdfAttr(el, local) {
  return el.hasAttributeNS(RDF_NS, local) ? el.getAttributeNS(RDF_NS, local) : null
}

function resolveIri(base, ref) {
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref)) return ref
  if (!base) return ref
  try {
    return new URL(ref, base).href
  } catch {
    return ref
  }
}

/**
 * Parse RDF/XML text into quads.
 *
 * @param {string} text the RDF/XML document or fragment
 * @param {object} [options]
 * @param {string} [options.baseIri] base IRI to resolve relative references against
 * @returns {{ quads: Array, prefixes: Object<string,string>, warnings: string[], baseIri: string }}
 * @throws {RdfXmlError} if the XML is malformed
 */
export function parseRdfXml(text, options = {}) {
  const prepared = prepareRdfXml(text)
  const warnings = prepared.warnings.slice()
  const quads = []
  const prefixes = {}
  let blankCounter = 0
  const nodeIds = new Map()

  if (typeof DOMParser === 'undefined') {
    throw new RdfXmlError('DOMParser is not available in this environment')
  }
  const doc = new DOMParser().parseFromString(prepared.xml, 'application/xml')
  const errorEl = doc.getElementsByTagName('parsererror')[0]
  if (errorEl) throw describeParseError(errorEl, prepared.lineOffset)
  const root = doc.documentElement
  if (!root) throw new RdfXmlError('Empty document')

  function emit(s, p, o) { quads.push(quad(s, p, o)) }
  function freshBlank() { return blankNode('b' + (blankCounter++)) }
  function blankFor(nodeId) {
    if (!nodeIds.has(nodeId)) {
      const label = /^b\d+$/.test(nodeId) ? 'n_' + nodeId : nodeId
      nodeIds.set(nodeId, blankNode(label))
    }
    return nodeIds.get(nodeId)
  }
  function warn(msg) { if (!warnings.includes(msg)) warnings.push(msg) }

  function collectPrefixes(el) {
    for (const attr of el.attributes) {
      if (attr.namespaceURI === XMLNS_NS || attr.name === 'xmlns' || attr.prefix === 'xmlns') {
        const prefix = attr.name === 'xmlns' ? '' : attr.localName
        if (!(prefix in prefixes)) prefixes[prefix] = attr.value
      }
    }
    for (const child of elementChildren(el)) collectPrefixes(child)
  }

  function inherit(el, ctx) {
    let base = ctx.base, lang = ctx.lang
    if (el.hasAttributeNS(XML_NS, 'base')) {
      base = resolveIri(ctx.base, el.getAttributeNS(XML_NS, 'base')).replace(/#.*$/, '')
    }
    if (el.hasAttributeNS(XML_NS, 'lang')) lang = el.getAttributeNS(XML_NS, 'lang')
    return { base, lang }
  }

  function elementIri(el) {
    if (!el.namespaceURI) {
      warn('Element <' + el.nodeName + '> has no namespace; its name was used as a relative IRI.')
      return namedNode(el.localName)
    }
    return namedNode(el.namespaceURI + el.localName)
  }

  /** Collects the property attributes as [iri, value, isRdfType]. */
  function propertyAttributes(el) {
    const out = []
    for (const attr of el.attributes) {
      if (attr.namespaceURI === XMLNS_NS || attr.name === 'xmlns' || attr.prefix === 'xmlns') continue
      if (attr.namespaceURI === XML_NS || attr.prefix === 'xml') continue
      if (attr.namespaceURI === RDF_NS) {
        if (attr.localName === 'type') { out.push([RDF.type, attr.value, true]); continue }
        if (NOT_PROPERTY_ATTRS.has(attr.localName)) continue
        out.push([RDF_NS + attr.localName, attr.value, false])
        continue
      }
      if (!attr.namespaceURI) {
        warn('Attribute "' + attr.name + '" on <' + el.nodeName + '> has no namespace and was ignored.')
        continue
      }
      out.push([attr.namespaceURI + attr.localName, attr.value, false])
    }
    return out
  }

  function parseNodeElement(el, parentCtx) {
    const ctx = inherit(el, parentCtx)
    const about = rdfAttr(el, 'about')
    const id = rdfAttr(el, 'ID')
    const nodeId = rdfAttr(el, 'nodeID')
    let subject
    if (about !== null) subject = namedNode(resolveIri(ctx.base, about))
    else if (id !== null) subject = namedNode(resolveIri(ctx.base, '#' + id))
    else if (nodeId !== null) subject = blankFor(nodeId)
    else subject = freshBlank()

    if (!isRdf(el, 'Description')) emit(subject, namedNode(RDF.type), elementIri(el))

    for (const [iri, value, isType] of propertyAttributes(el)) {
      if (isType) emit(subject, namedNode(RDF.type), namedNode(resolveIri(ctx.base, value)))
      else emit(subject, namedNode(iri), literal(value, ctx.lang))
    }

    let liCounter = 0
    for (const child of elementChildren(el)) {
      liCounter = parsePropertyElement(child, subject, ctx, liCounter)
    }
    return subject
  }

  function makeList(items) {
    if (!items.length) return namedNode(RDF.nil)
    const head = freshBlank()
    let current = head
    items.forEach((item, i) => {
      emit(current, namedNode(RDF.first), item)
      if (i === items.length - 1) {
        emit(current, namedNode(RDF.rest), namedNode(RDF.nil))
      } else {
        const next = freshBlank()
        emit(current, namedNode(RDF.rest), next)
        current = next
      }
    })
    return head
  }

  function serializeChildren(el) {
    const serializer = new XMLSerializer()
    let out = ''
    for (const child of el.childNodes) out += serializer.serializeToString(child)
    return out
  }

  function parsePropertyElement(el, subject, parentCtx, liCounter) {
    const ctx = inherit(el, parentCtx)
    let predicate
    if (isRdf(el, 'li')) {
      liCounter++
      predicate = namedNode(RDF_NS + '_' + liCounter)
    } else {
      predicate = elementIri(el)
    }
    const reifyId = rdfAttr(el, 'ID')
    const parseType = rdfAttr(el, 'parseType')
    const children = elementChildren(el)
    let object

    if (parseType === 'Resource') {
      object = freshBlank()
      let innerLi = 0
      for (const child of children) innerLi = parsePropertyElement(child, object, ctx, innerLi)
    } else if (parseType === 'Collection') {
      object = makeList(children.map(child => parseNodeElement(child, ctx)))
    } else if (parseType !== null) {
      // parseType "Literal" — and anything unrecognised — is handled as an XML literal
      object = literal(serializeChildren(el), namedNode(RDF.XMLLiteral))
    } else if (children.length) {
      if (children.length > 1) {
        warn('<' + el.nodeName + '> contains more than one node element; only the first was used.')
      }
      object = parseNodeElement(children[0], ctx)
    } else {
      const resource = rdfAttr(el, 'resource')
      const nodeId = rdfAttr(el, 'nodeID')
      const datatype = rdfAttr(el, 'datatype')
      const propAttrs = propertyAttributes(el)
      const text = el.textContent || ''
      if (resource === null && nodeId === null && propAttrs.length === 0) {
        object = datatype !== null
          ? literal(text, namedNode(resolveIri(ctx.base, datatype)))
          : literal(text, ctx.lang)
      } else {
        if (text.trim()) {
          warn('Text inside <' + el.nodeName + '> was ignored because the element also has rdf:resource, rdf:nodeID or property attributes.')
        }
        if (resource !== null) object = namedNode(resolveIri(ctx.base, resource))
        else if (nodeId !== null) object = blankFor(nodeId)
        else object = freshBlank()
        for (const [iri, value, isType] of propAttrs) {
          if (isType) emit(object, namedNode(RDF.type), namedNode(resolveIri(ctx.base, value)))
          else emit(object, namedNode(iri), literal(value, ctx.lang))
        }
      }
    }

    emit(subject, predicate, object)
    if (reifyId !== null) {
      const statement = namedNode(resolveIri(ctx.base, '#' + reifyId))
      emit(statement, namedNode(RDF.type), namedNode(RDF.Statement))
      emit(statement, namedNode(RDF.subject), subject)
      emit(statement, namedNode(RDF.predicate), predicate)
      emit(statement, namedNode(RDF.object), object)
    }
    return liCounter
  }

  collectPrefixes(root)
  delete prefixes.xml
  const baseIri = options.baseIri || ''
  const rootCtx = { base: baseIri, lang: '' }
  if (isRdf(root, 'RDF')) {
    const ctx = inherit(root, rootCtx)
    for (const child of elementChildren(root)) parseNodeElement(child, ctx)
  } else {
    parseNodeElement(root, rootCtx)
  }

  return {
    quads,
    prefixes: withStandardPrefixes(quads, prefixes),
    warnings,
    baseIri
  }
}
