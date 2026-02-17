<template>
  <div class="viewer-layout">
    <aside v-show="!sidebarCollapsed" class="viewer-sidebar">
      <div class="sidebar-header">
        <h2 class="sidebar-title">{{ repoName }}</h2>
        <div class="sidebar-actions">
          <button class="search-btn" @click="showSearch = true" title="Search">
            Search
          </button>
          <button class="collapse-btn" @click="sidebarCollapsed = true" title="Collapse sidebar">
            &#x2039;
          </button>
        </div>
      </div>
      <NavSidebar
        :repo-name="repoName"
        :current-file="currentFile"
        @navigate="onNavNavigate"
      />
    </aside>
    <main class="viewer-content">
      <div class="content-header">
        <div class="content-header-left">
          <button v-if="sidebarCollapsed" class="expand-btn" @click="sidebarCollapsed = false" title="Show sidebar">
            &#x203A;
          </button>
          <nav class="breadcrumb">
            <router-link :to="'/view/' + repoName + '/index.md'" class="breadcrumb-home" title="Home">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L1 7h2v6h4V9h2v4h4V7h2L8 1z"/></svg>
            </router-link>
            <template v-for="(crumb, i) in breadcrumbs" :key="i">
              <span class="breadcrumb-sep">/</span>
              <router-link
                v-if="crumb.to"
                :to="crumb.to"
                class="breadcrumb-link"
              >{{ crumb.label }}</router-link>
              <span v-else class="breadcrumb-current">{{ crumb.label }}</span>
            </template>
          </nav>
        </div>
        <div class="content-header-right">
          <button
            v-if="pdfStatus === 'ready'"
            class="download-pdf-btn"
            @click="downloadPdf"
            title="Download PDF"
          >
            PDF
          </button>
          <span v-else-if="pdfStatus === 'building'" class="pdf-building" title="PDF is being generated">
            <span class="saving-spinner"></span>
            Building PDF...
          </span>
          <router-link
            :to="'/edit/' + repoName + '/' + currentFile"
            class="edit-link"
          >
            Edit
          </router-link>
        </div>
      </div>
      <div class="content-body">
        <MarkdownRenderer
          v-if="fileContent !== null"
          :content="fileContent"
          :repo-name="repoName"
          :current-file="currentFile"
        />
        <div v-else-if="loading" class="loading">Loading...</div>
        <div v-else-if="error" class="error">{{ error }}</div>
      </div>
    </main>
    <SearchOverlay
      :repo-name="repoName"
      :visible="showSearch"
      @close="showSearch = false"
      @navigate="onSearchNavigate"
    />
  </div>
</template>

<script>
import NavSidebar from '@/components/viewer/NavSidebar.vue'
import MarkdownRenderer from '@/components/viewer/MarkdownRenderer.vue'
import SearchOverlay from '@/components/viewer/SearchOverlay.vue'
import { apiFetch } from '@/utils/api'
import { withBase } from '@/utils/basePath'

export default {
  name: 'ViewerLayout',
  components: {
    NavSidebar,
    MarkdownRenderer,
    SearchOverlay
  },
  data() {
    return {
      fileContent: null,
      loading: false,
      error: null,
      showSearch: false,
      sidebarCollapsed: false,
      pdfStatus: 'idle',
      pdfPollTimer: null,
      titleMap: {}
    }
  },
  computed: {
    repoName() {
      return this.$route.params.repoName
    },
    currentFile() {
      const pathMatch = this.$route.params.pathMatch
      if (Array.isArray(pathMatch)) {
        return pathMatch.join('/')
      }
      return pathMatch || ''
    },
    breadcrumbs() {
      if (!this.currentFile) return []
      const parts = this.currentFile.split('/')
      const crumbs = []
      const viewBase = '/view/' + this.repoName + '/'

      // Skip if we're at root index.md (home icon covers it)
      if (parts.length === 1 && parts[0] === 'index.md') return []

      // Directory segments
      let pathSoFar = ''
      for (let i = 0; i < parts.length - 1; i++) {
        pathSoFar = pathSoFar ? pathSoFar + '/' + parts[i] : parts[i]
        const dirTitle = this.titleMap[pathSoFar] || this.formatName(parts[i])
        const indexPath = pathSoFar + '/index.md'
        crumbs.push({
          label: dirTitle,
          to: viewBase + indexPath
        })
      }

      // Current file (last segment) — not clickable
      const filePath = this.currentFile
      const fileName = parts[parts.length - 1]
      // Don't show "Index" breadcrumb if it's the index.md of a directory (already shown via dir)
      if (fileName === 'index.md' && parts.length > 1) return crumbs
      const fileTitle = this.titleMap[filePath] || this.formatName(fileName)
      crumbs.push({ label: fileTitle, to: null })

      return crumbs
    }
  },
  watch: {
    '$route.params': {
      handler() {
        this.loadFile()
      },
      deep: true
    },
    repoName: {
      handler() {
        this.checkPdfStatus()
        this.fetchTitleMap()
      },
      immediate: true
    }
  },
  mounted() {
    this.loadFile()
    window.addEventListener('keydown', this.handleKeydown)
    this.startPdfPolling()
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.handleKeydown)
    this.stopPdfPolling()
  },
  methods: {
    async fetchTitleMap() {
      if (!this.repoName) return
      try {
        const response = await apiFetch('/api/repos/' + this.repoName + '/tree')
        if (!response.ok) return
        const tree = await response.json()
        const map = {}
        const walk = (items) => {
          for (const item of items) {
            if (item.title) {
              map[item.path] = item.title
            }
            if (item.children) {
              walk(item.children)
            }
          }
        }
        walk(tree)
        this.titleMap = map
      } catch {
        // ignore
      }
    },
    formatName(name) {
      return name
        .replace(/\.md$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    },
    async loadFile() {
      if (!this.repoName || !this.currentFile) return
      this.loading = true
      this.error = null
      this.fileContent = null
      try {
        const response = await apiFetch(
          '/api/repos/' + this.repoName + '/file/' + this.currentFile
        )
        if (!response.ok) {
          throw new Error('Failed to load file: ' + response.statusText)
        }
        const data = await response.json()
        this.fileContent = data.content
      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },
    onSearchNavigate(filePath) {
      this.showSearch = false
      this.$router.push('/view/' + this.repoName + '/' + filePath)
    },
    onNavNavigate(filePath) {
      this.$router.push('/view/' + this.repoName + '/' + filePath)
    },
    handleKeydown(e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'k')) {
        e.preventDefault()
        this.showSearch = !this.showSearch
      }
      if (e.key === 'Escape') {
        this.showSearch = false
      }
    },
    async checkPdfStatus() {
      if (!this.repoName) return
      try {
        const response = await apiFetch(
          '/api/repos/' + this.repoName + '/pdf/status'
        )
        if (response.ok) {
          const data = await response.json()
          this.pdfStatus = data.status
        }
      } catch {
        // ignore
      }
    },
    startPdfPolling() {
      this.pdfPollTimer = setInterval(() => {
        if (this.pdfStatus !== 'ready') {
          this.checkPdfStatus()
        }
      }, 5000)
    },
    stopPdfPolling() {
      if (this.pdfPollTimer) {
        clearInterval(this.pdfPollTimer)
        this.pdfPollTimer = null
      }
    },
    async downloadPdf() {
      const url = withBase('/api/repos/' + this.repoName + '/pdf/download')
      const a = document.createElement('a')
      a.href = url
      a.download = this.repoName + '.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }
}
</script>

<style scoped>
.viewer-layout {
  display: flex;
  min-height: 100vh;
}

.viewer-sidebar {
  width: 280px;
  min-width: 280px;
  background: #fff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  height: 100vh;
  position: sticky;
  top: 0;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: #1a202c;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.search-btn {
  padding: 4px 12px;
  font-size: 12px;
  background: #edf2f7;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  cursor: pointer;
  color: #4a5568;
}

.search-btn:hover {
  background: #e2e8f0;
}

.collapse-btn,
.expand-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: #edf2f7;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  cursor: pointer;
  color: #4a5568;
  font-size: 16px;
  font-weight: bold;
  line-height: 1;
  flex-shrink: 0;
}

.collapse-btn:hover,
.expand-btn:hover {
  background: #e2e8f0;
}

.viewer-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.content-header {
  padding: 12px 24px;
  border-bottom: 1px solid #e2e8f0;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 10;
}

.content-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.content-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #718096;
  min-width: 0;
}

.breadcrumb-home {
  display: inline-flex;
  align-items: center;
  color: #718096;
  text-decoration: none;
  flex-shrink: 0;
}

.breadcrumb-home:hover {
  color: #4a90d9;
}

.breadcrumb-sep {
  color: #cbd5e0;
  flex-shrink: 0;
}

.breadcrumb-link {
  color: #4a90d9;
  text-decoration: none;
  white-space: nowrap;
}

.breadcrumb-link:hover {
  text-decoration: underline;
}

.breadcrumb-current {
  color: #4a5568;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.download-pdf-btn {
  padding: 4px 12px;
  font-size: 12px;
  background: #edf2f7;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  cursor: pointer;
  color: #4a5568;
}

.download-pdf-btn:hover {
  background: #e2e8f0;
}

.pdf-building {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #a0aec0;
}

.edit-link {
  padding: 4px 12px;
  font-size: 12px;
  background: #4a90d9;
  color: #fff;
  border-radius: 4px;
  text-decoration: none;
}

.edit-link:hover {
  background: #357abd;
}

.content-body {
  flex: 1;
  padding: 24px 48px;
  max-width: 900px;
}

.loading,
.error {
  padding: 48px;
  text-align: center;
  color: #718096;
}

.error {
  color: #e53e3e;
}
</style>
