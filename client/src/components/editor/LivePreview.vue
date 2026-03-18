<template>
  <div class="live-preview">
    <div class="preview-content">
      <MarkdownRenderer
        :content="resolvedContent"
        :repo-name="repoName"
        :current-file="currentFile"
        mode="edit"
      />
    </div>
  </div>
</template>

<script>
import MarkdownRenderer from '@/components/viewer/MarkdownRenderer.vue'
import { apiFetch } from '@/utils/api'

export default {
  name: 'LivePreview',
  components: {
    MarkdownRenderer
  },
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
    }
  },
  data() {
    return {
      includeCache: {},
      resolveTimer: null,
      resolvedContent: '',
      globalStyle: null
    }
  },
  watch: {
    content: {
      handler() {
        this.scheduleResolve()
      },
      immediate: true
    },
    currentFile() {
      this.includeCache = {}
      this.fetchGlobalStyle()
    },
    repoName: {
      handler() {
        this.fetchGlobalStyle()
      },
      immediate: true
    }
  },
  methods: {
    async fetchGlobalStyle() {
      if (!this.repoName) return
      try {
        const response = await apiFetch(
          '/api/repos/' + this.repoName + '/file/global-style.md?raw'
        )
        if (response.ok) {
          const data = await response.json()
          this.globalStyle = data.content
        } else {
          this.globalStyle = null
        }
      } catch {
        this.globalStyle = null
      }
      this.scheduleResolve()
    },
    scheduleResolve() {
      if (this.resolveTimer) clearTimeout(this.resolveTimer)
      this.resolveTimer = setTimeout(() => this.resolveIncludes(), 300)
    },
    async resolveIncludes() {
      const includeRegex = /^<include\s+([^>]+)>\s*$/gim
      const matches = []
      let match
      while ((match = includeRegex.exec(this.content)) !== null) {
        matches.push(match[1].trim())
      }

      if (matches.length === 0) {
        this.resolvedContent = this.withGlobalStyle(this.content)
        return
      }

      // Fetch any includes not yet cached
      const fileDir = this.currentFile.replace(/\/[^/]*$/, '')
      const fetches = matches
        .filter(name => !(name.toLowerCase() in this.includeCache))
        .map(async name => {
          const subpagePath = fileDir + '/subpages/' + name
          try {
            const response = await apiFetch(
              '/api/repos/' + this.repoName + '/file/' + subpagePath + '?raw'
            )
            if (response.ok) {
              const data = await response.json()
              this.includeCache[name.toLowerCase()] = data.content
            } else {
              this.includeCache[name.toLowerCase()] = null
            }
          } catch {
            this.includeCache[name.toLowerCase()] = null
          }
        })

      if (fetches.length > 0) {
        await Promise.all(fetches)
      }

      // Replace includes with cached content
      const replaced = this.content.replace(
        /^<include\s+([^>]+)>\s*$/gim,
        (line, name) => {
          name = name.trim()
          const cached = this.includeCache[name.toLowerCase()]
          if (cached != null) return cached
          return '<div style="color: red; font-weight: bold; padding: 8px; border: 1px solid red; border-radius: 4px; margin: 8px 0;">INCLUDE FAILED: "' + name + '" not found in subpages/</div>'
        }
      )
      this.resolvedContent = this.withGlobalStyle(replaced)
    },
    withGlobalStyle(content) {
      if (this.globalStyle) {
        return this.globalStyle + '\n\n' + content
      }
      return content
    }
  }
}
</script>

<style scoped>
.live-preview {
  flex: 1;
  overflow-y: auto;
}

.preview-content {
  padding: 24px;
  max-width: 800px;
}
</style>
