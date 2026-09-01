/**
 * Builds and lays out the graph shown in the RDF viewer.
 *
 * buildGraph(): turns quads into { nodes, edges } carrying display labels.
 *   IRIs and blank nodes collapse into one node each; every literal
 *   occurrence becomes its own node, the way classic RDF graphs are drawn.
 * layoutGraph(): arranges nodes and edge labels using dagre.
 */

import * as dagre from '@dagrejs/dagre'
import { RDF, XSD, compactIri, termKey, shortenIri } from './terms'

const MAX_LITERAL = 40
const MAX_IRI_LABEL = 36

function truncate(text, max) {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat
}

/**
 * @param {{ quads: Array, prefixes: Object<string,string> }} parsed
 */
export function buildGraph(parsed) {
  const quads = parsed.quads || []
  const prefixes = parsed.prefixes || {}
  const nodes = []
  const nodeIndex = new Map()
  const edges = []

  // Prefer a prefixed name; otherwise the scheme-stripped IRI, cut down
  // from the middle. The tooltip still carries the full IRI.
  function iriLabel(value) {
    return compactIri(value, prefixes) || shortenIri(value.replace(/^https?:\/\//, ''), MAX_IRI_LABEL)
  }

  function resourceNode(term) {
    const key = termKey(term)
    let node = nodeIndex.get(key)
    if (!node) {
      if (term.termType === 'BlankNode') {
        node = { id: 'n' + nodes.length, kind: 'blank', label: '_:' + term.value, sublabel: '', title: 'Blank node _:' + term.value, isClass: false }
      } else {
        node = { id: 'n' + nodes.length, kind: 'iri', label: iriLabel(term.value), sublabel: '', title: term.value, isClass: false }
      }
      nodeIndex.set(key, node)
      nodes.push(node)
    }
    return node
  }

  function literalNode(term) {
    let sublabel = ''
    let title = term.value
    if (term.language) {
      sublabel = '@' + term.language
      title += ' @' + term.language
    } else if (term.datatype.value !== XSD.string) {
      sublabel = '^^' + iriLabel(term.datatype.value)
      title += ' ^^' + term.datatype.value
    }
    const node = { id: 'n' + nodes.length, kind: 'literal', label: '"' + truncate(term.value, MAX_LITERAL) + '"', sublabel, title, isClass: false }
    nodes.push(node)
    return node
  }

  quads.forEach((q, i) => {
    const source = resourceNode(q.subject)
    const target = q.object.termType === 'Literal' ? literalNode(q.object) : resourceNode(q.object)
    const isType = q.predicate.value === RDF.type
    if (isType && target.kind === 'iri') target.isClass = true
    edges.push({
      id: 'e' + i,
      source: source.id,
      target: target.id,
      kind: isType ? 'type' : 'prop',
      label: iriLabel(q.predicate.value),
      title: q.predicate.value
    })
  })

  return { nodes, edges }
}

function defaultMeasure(text, fontSize) {
  return text.length * fontSize * 0.6
}

/**
 * @param {{ nodes: Array, edges: Array }} graph
 * @param {object} [options]
 * @param {'TB'|'LR'} [options.rankdir='TB']
 * @param {function} [options.measure] (text, fontSize) => width in px
 */
export function layoutGraph(graph, options = {}) {
  const rankdir = options.rankdir || 'TB'
  const measure = options.measure || defaultMeasure
  const fontSize = options.fontSize || 12
  const subFontSize = fontSize - 2
  const lineHeight = fontSize + 4

  const g = new dagre.graphlib.Graph({ multigraph: true })
  // dagre gives edge labels a rank of their own, so each real rank gap pays
  // ranksep twice; keep it small or the layout sprawls.
  g.setGraph({ rankdir, nodesep: 22, ranksep: 40, edgesep: 14, marginx: 16, marginy: 16 })
  g.setDefaultEdgeLabel(() => ({}))

  const nodes = graph.nodes.map(node => {
    const labelWidth = measure(node.label, fontSize)
    const subWidth = node.sublabel ? measure(node.sublabel, subFontSize) : 0
    const textWidth = Math.max(labelWidth, subWidth)
    const textHeight = node.sublabel ? lineHeight * 2 : lineHeight
    let width, height
    if (node.kind === 'literal') {
      width = textWidth + 24
      height = textHeight + 16
    } else {
      // the ellipse has to contain the whole text box
      width = textWidth * 1.3 + 24
      height = textHeight * 1.5 + 12
    }
    const out = Object.assign({}, node, { width: Math.ceil(width), height: Math.ceil(height) })
    g.setNode(node.id, { width: out.width, height: out.height })
    return out
  })

  const edges = graph.edges.map(edge => {
    const labelWidth = Math.ceil(measure(edge.label, subFontSize) + 12)
    const labelHeight = subFontSize + 10
    g.setEdge(edge.source, edge.target, { width: labelWidth, height: labelHeight, labelpos: 'c' }, edge.id)
    return Object.assign({}, edge, { labelWidth, labelHeight })
  })

  dagre.layout(g)

  for (const node of nodes) {
    const pos = g.node(node.id)
    node.x = pos.x
    node.y = pos.y
  }
  for (const edge of edges) {
    const e = g.edge(edge.source, edge.target, edge.id)
    edge.points = e.points || []
    edge.labelX = e.x
    edge.labelY = e.y
  }
  const size = g.graph()
  return { nodes, edges, width: Math.ceil(size.width || 0), height: Math.ceil(size.height || 0), rankdir }
}

/** Draws a smooth quadratic curve through the points as an SVG path. */
export function edgePath(points) {
  if (!points || points.length === 0) return ''
  if (points.length === 1) return 'M' + points[0].x + ',' + points[0].y
  if (points.length === 2) {
    return 'M' + points[0].x + ',' + points[0].y + ' L' + points[1].x + ',' + points[1].y
  }
  let d = 'M' + points[0].x + ',' + points[0].y
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]
    const next = points[i + 1]
    d += ' Q' + p.x + ',' + p.y + ' ' + (p.x + next.x) / 2 + ',' + (p.y + next.y) / 2
  }
  const last = points[points.length - 1]
  d += ' L' + last.x + ',' + last.y
  return d
}
