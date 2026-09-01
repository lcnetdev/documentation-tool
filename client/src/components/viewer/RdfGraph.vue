<template>
  <div class="rdf-graph">
    <div class="rdf-graph-toolbar">
      <div class="rdf-graph-legend" aria-hidden="true">
        <span class="legend-item"><span class="swatch swatch-iri"></span>Resource</span>
        <span class="legend-item"><span class="swatch swatch-class"></span>Class</span>
        <span class="legend-item"><span class="swatch swatch-blank"></span>Blank node</span>
        <span class="legend-item"><span class="swatch swatch-literal"></span>Literal</span>
      </div>
      <div class="rdf-graph-controls">
        <select v-model="rankdir" aria-label="Layout direction">
          <option value="TB">Top to bottom</option>
          <option value="LR">Left to right</option>
        </select>
        <button type="button" aria-label="Zoom in" title="Zoom in" @click="zoomBy(1.25)">+</button>
        <button type="button" aria-label="Zoom out" title="Zoom out" @click="zoomBy(0.8)">−</button>
        <button type="button" title="Fit the whole graph into the view" @click="fit">Fit</button>
        <button type="button" title="Show the graph at its natural size (drag to pan)" @click="resetView">100%</button>
      </div>
    </div>
    <div
      ref="viewport"
      class="rdf-graph-viewport"
      :class="{ dragging }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel="onWheel"
    >
      <svg v-if="layout" class="rdf-graph-svg" width="100%" height="100%" role="img" aria-label="RDF graph">
        <defs>
          <marker :id="markerId" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" class="rdf-arrow" />
          </marker>
        </defs>
        <g :transform="transform">
          <g v-for="edge in layout.edges" :key="edge.id" class="rdf-edge" :class="'rdf-edge-' + edge.kind">
            <title>{{ edge.title }}</title>
            <path :d="edgePath(edge.points)" :marker-end="'url(#' + markerId + ')'" />
            <g v-if="edge.labelX != null" class="rdf-edge-label" :transform="'translate(' + edge.labelX + ',' + edge.labelY + ')'">
              <rect :x="-edge.labelWidth / 2" :y="-edge.labelHeight / 2" :width="edge.labelWidth" :height="edge.labelHeight" rx="3" />
              <text text-anchor="middle" dominant-baseline="central">{{ edge.label }}</text>
            </g>
          </g>
          <g
            v-for="node in layout.nodes"
            :key="node.id"
            class="rdf-node"
            :class="['rdf-node-' + node.kind, { 'rdf-node-class': node.isClass }]"
            :transform="'translate(' + node.x + ',' + node.y + ')'"
          >
            <title>{{ node.title }}</title>
            <rect v-if="node.kind === 'literal'" :x="-node.width / 2" :y="-node.height / 2" :width="node.width" :height="node.height" rx="4" />
            <ellipse v-else :rx="node.width / 2" :ry="node.height / 2" />
            <text text-anchor="middle" dominant-baseline="central" :dy="node.sublabel ? -8 : 0">{{ node.label }}</text>
            <text v-if="node.sublabel" class="rdf-sublabel" text-anchor="middle" dominant-baseline="central" dy="10">{{ node.sublabel }}</text>
          </g>
        </g>
      </svg>
      <div v-else class="rdf-graph-empty">No triples to display.</div>
    </div>
  </div>
</template>

<script>
import { markRaw } from 'vue'
import { buildGraph, layoutGraph, edgePath } from '@/utils/rdf/graph'

const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const MIN_SCALE = 0.1
const MAX_SCALE = 4
const FONT_SIZE = 13
const MARGIN = 12

let instanceCounter = 0
let measureContext = null

function getMeasureContext() {
  if (measureContext !== null) return measureContext
  measureContext = false
  try {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext && canvas.getContext('2d')
      if (ctx && typeof ctx.measureText === 'function') measureContext = ctx
    }
  } catch {
    measureContext = false
  }
  return measureContext
}

/**
 * Draws an RDF dataset as a directed graph: ellipses for resources and blank
 * nodes, boxes for literals, labeled arrows for predicates. dagre handles
 * the layout.
 */
export default {
  name: 'RdfGraph',
  props: {
    /** What parseRdfXml hands back: { quads, prefixes } */
    parsed: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      layout: null,
      rankdir: 'TB',
      tx: 0,
      ty: 0,
      k: 1,
      dragging: false,
      markerId: 'rdf-arrow-' + (++instanceCounter)
    }
  },
  computed: {
    transform() {
      return 'translate(' + this.tx + ' ' + this.ty + ') scale(' + this.k + ')'
    }
  },
  watch: {
    parsed() {
      this.relayout()
    },
    rankdir() {
      this.relayout()
    }
  },
  mounted() {
    this.relayout()
  },
  methods: {
    edgePath,
    measure(text, fontSize) {
      const ctx = getMeasureContext()
      if (ctx) {
        ctx.font = fontSize + 'px ' + FONT_FAMILY
        return ctx.measureText(text).width
      }
      return text.length * fontSize * 0.6
    },
    relayout() {
      const graph = buildGraph(this.parsed)
      if (!graph.nodes.length) {
        this.layout = null
        return
      }
      this.layout = markRaw(layoutGraph(graph, { rankdir: this.rankdir, measure: this.measure, fontSize: FONT_SIZE }))
      this.$nextTick(() => this.resetView())
    },
    /**
     * Natural size (scale 1). Anything bigger than the view starts pinned to
     * the top-left and can be dragged around; anything smaller sits centred.
     * Readable labels win over fitting it all on screen.
     */
    resetView() {
      const viewport = this.$refs.viewport
      if (!viewport || !this.layout) return
      const cw = viewport.clientWidth
      const ch = viewport.clientHeight
      this.k = 1
      this.tx = cw > this.layout.width ? (cw - this.layout.width) / 2 : MARGIN
      this.ty = ch > this.layout.height ? (ch - this.layout.height) / 2 : MARGIN
    },
    /** Zoom out only — never in — until the whole graph fits. */
    fit() {
      const viewport = this.$refs.viewport
      if (!viewport || !this.layout) return
      const cw = viewport.clientWidth
      const ch = viewport.clientHeight
      if (!cw || !ch) return
      const k = Math.min(cw / this.layout.width, ch / this.layout.height, 1)
      this.k = k
      this.tx = (cw - this.layout.width * k) / 2
      this.ty = (ch - this.layout.height * k) / 2
    },
    zoomBy(factor, cx, cy) {
      const viewport = this.$refs.viewport
      if (!viewport) return
      const px = cx == null ? viewport.clientWidth / 2 : cx
      const py = cy == null ? viewport.clientHeight / 2 : cy
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.k * factor))
      const ratio = next / this.k
      this.tx = px - (px - this.tx) * ratio
      this.ty = py - (py - this.ty) * ratio
      this.k = next
    },
    onWheel(event) {
      // A plain wheel scrolls the document; ctrl/cmd + wheel (or a trackpad pinch) zooms.
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      this.zoomBy(Math.exp(-event.deltaY * 0.01), event.clientX - rect.left, event.clientY - rect.top)
    },
    onPointerDown(event) {
      if (event.button !== 0) return
      this.dragging = true
      this.dragStart = { x: event.clientX, y: event.clientY, tx: this.tx, ty: this.ty }
      if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId)
    },
    onPointerMove(event) {
      if (!this.dragging || !this.dragStart) return
      this.tx = this.dragStart.tx + (event.clientX - this.dragStart.x)
      this.ty = this.dragStart.ty + (event.clientY - this.dragStart.y)
    },
    onPointerUp(event) {
      if (!this.dragging) return
      this.dragging = false
      if (event.currentTarget.releasePointerCapture && event.currentTarget.hasPointerCapture &&
          event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    }
  }
}
</script>

<style scoped>
.rdf-graph {
  background: var(--bg-surface);
  color: var(--text-primary);
}

.rdf-graph-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px 16px;
  flex-wrap: wrap;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-muted);
}

.rdf-graph-legend {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.swatch {
  display: inline-block;
  width: 16px;
  height: 11px;
  border: 1.5px solid var(--color-primary);
  border-radius: 50%;
  background: var(--bg-surface);
}

.swatch-class {
  background: var(--color-primary-bg);
  border-color: var(--color-primary-dark);
}

.swatch-blank {
  border-style: dashed;
  border-color: var(--text-muted);
}

.swatch-literal {
  border-radius: 2px;
  border-color: var(--text-muted);
  background: var(--bg-surface-alt);
}

.rdf-graph-controls {
  display: flex;
  gap: 4px;
  align-items: center;
}

.rdf-graph-controls button,
.rdf-graph-controls select {
  appearance: none;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-surface);
  color: var(--text-tertiary);
  font: inherit;
  font-size: 12px;
  padding: 3px 8px;
  cursor: pointer;
  line-height: 1.4;
}

.rdf-graph-controls button:hover,
.rdf-graph-controls select:hover {
  color: var(--text-primary);
  background: var(--bg-surface-hover);
}

.rdf-graph-viewport {
  position: relative;
  height: 520px;
  min-height: 200px;
  resize: vertical;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.rdf-graph-viewport.dragging {
  cursor: grabbing;
}

.rdf-graph-svg {
  display: block;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.rdf-graph-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}

.rdf-node ellipse,
.rdf-node rect {
  fill: var(--bg-surface);
  stroke: var(--color-primary);
  stroke-width: 1.5;
}

.rdf-node-literal rect {
  fill: var(--bg-surface-alt);
  stroke: var(--text-muted);
}

.rdf-node-blank ellipse {
  stroke: var(--text-muted);
  stroke-dasharray: 4 3;
}

.rdf-node-class ellipse {
  fill: var(--color-primary-bg);
  stroke: var(--color-primary-dark);
}

.rdf-node text {
  fill: var(--text-primary);
  font-size: 13px;
  pointer-events: none;
}

.rdf-node .rdf-sublabel {
  font-size: 11px;
  fill: var(--text-muted);
}

.rdf-edge path {
  fill: none;
  stroke: var(--text-tertiary);
  stroke-width: 1.5;
}

.rdf-edge-type path {
  stroke-dasharray: 5 4;
}

.rdf-arrow {
  fill: var(--text-tertiary);
}

.rdf-edge-label rect {
  fill: var(--bg-surface);
  stroke: var(--border-color);
  stroke-width: 1;
}

.rdf-edge-label text {
  font-size: 11px;
  fill: var(--text-secondary);
  pointer-events: none;
}
</style>
