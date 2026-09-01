<template>
  <div class="rdf-block-ui">
    <div class="rdf-tabs" role="tablist" aria-label="RDF serializations">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        class="rdf-tab"
        :class="{ active: activeTab === tab.id }"
        :aria-selected="activeTab === tab.id ? 'true' : 'false'"
        @click="select(tab.id)"
      >{{ tab.label }}</button>
      <span class="rdf-tabs-spacer"></span>
      <span v-if="tripleCount !== null" class="rdf-meta">{{ tripleCount }} {{ tripleCount === 1 ? 'triple' : 'triples' }}</span>
      <button v-if="activeTab !== 'graph'" type="button" class="rdf-copy" @click="copy">{{ copied ? 'Copied!' : 'Copy' }}</button>
    </div>
    <div class="rdf-panel" role="tabpanel">
      <pre v-if="activeTab === 'source'"><code class="language-xml" v-html="sourceHtml"></code></pre>
      <div v-else-if="loading && !parsed" class="rdf-status">Converting…</div>
      <div v-else-if="error" class="rdf-error">
        <strong>Could not parse this block as RDF/XML.</strong>
        <div class="rdf-error-detail">{{ error }}</div>
      </div>
      <template v-else-if="parsed">
        <ul v-if="warnings.length" class="rdf-warnings">
          <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
        </ul>
        <pre v-if="activeTab === 'turtle'"><code class="language-turtle" v-html="turtleHtml"></code></pre>
        <pre v-else-if="activeTab === 'jsonld'"><code class="language-json" v-html="jsonldHtml"></code></pre>
        <RdfGraph v-else-if="activeTab === 'graph'" :parsed="parsed" />
      </template>
    </div>
  </div>
</template>

<script>
import { defineAsyncComponent, markRaw } from 'vue'
import { highlightCode } from '@/utils/highlight'

let rdfModulePromise = null
function loadRdf() {
  if (!rdfModulePromise) rdfModulePromise = import('@/utils/rdf')
  return rdfModulePromise
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function highlight(text, lang) {
  const result = highlightCode(text, lang)
  return result ? result.html : escapeHtml(text)
}

/**
 * Tabs for an RDF/XML code block: the highlighted source alongside Turtle,
 * JSON-LD and graph views, all worked out on demand.
 */
export default {
  name: 'RdfCodeBlock',
  components: {
    RdfGraph: defineAsyncComponent(() => import('./RdfGraph.vue'))
  },
  props: {
    /** The raw RDF/XML text */
    source: {
      type: String,
      default: ''
    },
    /** The source, already highlighted (and sanitized) as HTML */
    sourceHtml: {
      type: String,
      default: ''
    },
    sourceLabel: {
      type: String,
      default: 'RDF/XML'
    }
  },
  data() {
    return {
      activeTab: 'source',
      loading: false,
      pending: false,
      error: null,
      parsed: null,
      warnings: [],
      turtleText: '',
      turtleHtml: '',
      jsonldText: '',
      jsonldHtml: '',
      copied: false,
      copyTimer: null
    }
  },
  computed: {
    tabs() {
      return [
        { id: 'source', label: this.sourceLabel },
        { id: 'jsonld', label: 'JSON-LD' },
        { id: 'turtle', label: 'Turtle' },
        { id: 'graph', label: 'Graph' }
      ]
    },
    tripleCount() {
      return this.parsed ? this.parsed.quads.length : null
    }
  },
  watch: {
    source() {
      this.parsed = null
      this.error = null
      if (this.activeTab !== 'source') this.ensureParsed()
    }
  },
  beforeUnmount() {
    clearTimeout(this.copyTimer)
  },
  methods: {
    select(id) {
      this.activeTab = id
      if (id !== 'source') this.ensureParsed()
    },
    async ensureParsed() {
      if (this.parsed || this.error) return
      if (this.loading) {
        this.pending = true
        return
      }
      this.loading = true
      try {
        do {
          this.pending = false
          const source = this.source
          const result = await this.convert(source)
          if (source !== this.source) {
            this.pending = true
            continue
          }
          if (result.error) {
            this.error = result.error
          } else {
            this.parsed = markRaw(result.parsed)
            this.warnings = result.parsed.warnings || []
            this.turtleText = result.turtle
            this.turtleHtml = highlight(result.turtle, 'turtle')
            this.jsonldText = result.jsonld
            this.jsonldHtml = highlight(result.jsonld, 'json')
          }
        } while (this.pending)
      } finally {
        this.loading = false
      }
    },
    async convert(source) {
      try {
        const rdf = await loadRdf()
        const parsed = rdf.parseRdfXml(source)
        return {
          parsed,
          turtle: rdf.toTurtle(parsed),
          jsonld: rdf.toJsonLdString(parsed)
        }
      } catch (err) {
        return { error: err && err.message ? err.message : String(err) }
      }
    },
    currentText() {
      if (this.activeTab === 'turtle') return this.turtleText
      if (this.activeTab === 'jsonld') return this.jsonldText
      return this.source
    },
    async copy() {
      const text = this.currentText()
      if (!text || !navigator.clipboard) return
      try {
        await navigator.clipboard.writeText(text)
        this.copied = true
        clearTimeout(this.copyTimer)
        this.copyTimer = setTimeout(() => { this.copied = false }, 1200)
      } catch {
        // no clipboard access (insecure context); give up quietly
      }
    }
  }
}
</script>

<style scoped>
.rdf-block-ui {
  margin: 1em 0;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg-surface);
}

.rdf-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px 0;
  background: var(--bg-surface-alt);
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
}

.rdf-tab {
  appearance: none;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 5px 5px 0 0;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 13px;
  padding: 6px 12px;
  cursor: pointer;
  margin-bottom: -1px;
}

.rdf-tab:hover {
  color: var(--text-primary);
  background: var(--bg-surface-hover);
}

.rdf-tab.active {
  color: var(--text-primary);
  background: var(--bg-surface);
  border-color: var(--border-color);
  font-weight: 600;
}

.rdf-tabs-spacer {
  flex: 1;
}

.rdf-meta {
  font-size: 12px;
  color: var(--text-muted);
  padding: 0 8px;
}

.rdf-copy {
  appearance: none;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-surface);
  color: var(--text-tertiary);
  font: inherit;
  font-size: 12px;
  padding: 3px 10px;
  margin-bottom: 4px;
  cursor: pointer;
}

.rdf-copy:hover {
  color: var(--text-primary);
  background: var(--bg-surface-hover);
}

.rdf-panel :deep(pre) {
  margin: 0;
  border: none;
  border-radius: 0;
}

.rdf-status,
.rdf-error {
  padding: 16px;
  font-size: 14px;
  color: var(--text-muted);
}

.rdf-error {
  color: var(--color-error);
  background: var(--color-error-bg);
}

.rdf-error-detail {
  margin-top: 6px;
  font-family: 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  white-space: pre-wrap;
}

.rdf-warnings {
  margin: 0;
  padding: 8px 16px 8px 32px;
  font-size: 12px;
  color: var(--color-warning-text);
  background: var(--color-badge-bg);
  border-bottom: 1px solid var(--border-color);
}
</style>
