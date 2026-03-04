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
      this.$nextTick(() => {
        this.renderMermaid()
        this.scrollToHash()
      })
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.renderMermaid()
      this.scrollToHash()
    })
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
    findByHash(hash) {
      // Try the raw hash first (IDs may contain literal %2F etc.)
      const raw = hash.slice(1)
      let el = document.getElementById(raw)
      if (!el) {
        // Fallback: try decoded version
        try { el = document.getElementById(decodeURIComponent(raw)) } catch {}
      }
      return el
    },
    scrollToHash() {
      const hash = window.location.hash
      if (!hash) return
      // Wait for DOM to fully paint after v-html update
      setTimeout(() => {
        const el = this.findByHash(hash)
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    },
    showCopiedToast(anchor) {
      const toast = document.createElement('span')
      toast.textContent = 'Copied!'
      toast.className = 'heading-anchor-toast'
      anchor.parentElement.style.position = 'relative'
      anchor.parentElement.appendChild(toast)
      requestAnimationFrame(() => { toast.classList.add('show') })
      setTimeout(() => {
        toast.classList.remove('show')
        toast.classList.add('fade-out')
        setTimeout(() => toast.remove(), 300)
      }, 1200)
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

      // Heading anchor links: copy URL to clipboard and show "Copied" toast
      if (href.startsWith('#') && link.classList.contains('heading-anchor')) {
        e.preventDefault()
        const fullUrl = window.location.origin + window.location.pathname + window.location.search + href
        navigator.clipboard.writeText(fullUrl).then(() => {
          this.showCopiedToast(link)
        })
        history.replaceState(null, '', window.location.pathname + window.location.search + href)
        return
      }

      // Other hash links: scroll to the element
      if (href.startsWith('#')) {
        e.preventDefault()
        const el = this.findByHash(href)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' })
          history.replaceState(null, '', window.location.pathname + window.location.search + href)
        }
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
