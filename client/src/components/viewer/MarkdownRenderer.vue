<template>
  <div class="markdown-body" v-html="renderedHtml" @click="handleClick"></div>
</template>

<script>
import { createMarkdownRenderer } from '@/composables/useMarkdown'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose'
})

export default {
  name: 'MarkdownRenderer',
  props: {
    content: {
      type: String,
      default: ''
    },
    repoName: {
      type: String,
      default: ''
    },
    currentFile: {
      type: String,
      default: ''
    },
    mode: {
      type: String,
      default: 'view'
    }
  },
  computed: {
    renderedHtml() {
      const md = createMarkdownRenderer(this.repoName, this.currentFile, this.mode)
      return md.render(this.content || '')
    }
  },
  watch: {
    renderedHtml() {
      this.$nextTick(() => this.renderMermaid())
    }
  },
  mounted() {
    this.$nextTick(() => this.renderMermaid())
  },
  methods: {
    async renderMermaid() {
      const container = this.$el
      if (!container) return
      const nodes = container.querySelectorAll('pre.mermaid')
      if (!nodes.length) return

      const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
      const lineColor = isDark ? '#e2e8f0' : '#1a202c'

      // Render each diagram individually using mermaid.render() for full control.
      // This avoids stale state from mermaid.initialize() + mermaid.run().
      let counter = Date.now()
      for (const node of nodes) {
        const graphDef = node.textContent || ''
        const id = 'mmd-' + (counter++)
        try {
          const { svg } = await mermaid.render(id, graphDef)
          // Create a wrapper div with the rendered SVG
          const wrapper = document.createElement('div')
          wrapper.className = 'mermaid-diagram'
          wrapper.innerHTML = svg
          // Inject override styles into the SVG
          const svgEl = wrapper.querySelector('svg')
          if (svgEl) {
            const svgId = svgEl.getAttribute('id') || id
            const overrideStyle = document.createElementNS('http://www.w3.org/2000/svg', 'style')
            overrideStyle.textContent =
              '#' + svgId + ' .edge-thickness-normal { stroke-width: 2px !important; }\n' +
              '#' + svgId + ' .edge-thickness-thick { stroke-width: 3.5px !important; }\n' +
              '#' + svgId + ' .edge-pattern-solid { stroke: ' + lineColor + ' !important; }\n' +
              '#' + svgId + ' .flowchart-link { stroke: ' + lineColor + ' !important; }\n' +
              '#' + svgId + ' .marker { fill: ' + lineColor + ' !important; stroke: ' + lineColor + ' !important; }\n' +
              '#' + svgId + ' .edgePath .path { stroke: ' + lineColor + ' !important; stroke-width: 2px !important; }\n' +
              '#' + svgId + ' [marker-end] { stroke: ' + lineColor + ' !important; }\n' +
              '#' + svgId + ' marker path { fill: ' + lineColor + ' !important; stroke: ' + lineColor + ' !important; }\n'
            svgEl.appendChild(overrideStyle)
          }
          node.replaceWith(wrapper)
        } catch (err) {
          console.error('Mermaid render error:', err)
        }
      }
    },
    handleClick(e) {
      const link = e.target.closest('a')
      if (!link) return

      const href = link.getAttribute('href')
      if (!href) return

      // External links: let browser handle
      if (href.startsWith('http://') || href.startsWith('https://')) {
        return
      }

      // Internal router links
      if (href.startsWith('/view/') || href.startsWith('/edit/')) {
        e.preventDefault()
        this.$router.push(href)
      }
    }
  }
}
</script>

<style scoped>
.markdown-body {
  line-height: 1.7;
  color: var(--text-primary);
  word-wrap: break-word;
}
</style>
