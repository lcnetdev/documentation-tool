<template>
  <div class="markdown-body" v-html="renderedHtml" @click="handleClick"></div>
</template>

<script>
import { createMarkdownRenderer } from '@/composables/useMarkdown'

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
  methods: {
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
  color: #1a202c;
  word-wrap: break-word;
}
</style>
