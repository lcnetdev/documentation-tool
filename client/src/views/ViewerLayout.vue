<template>
  <div class="viewer-layout">
    <aside v-show="!sidebarCollapsed" class="viewer-sidebar">
      <div class="sidebar-header">
        <div class="sidebar-title-row">
          <h2 class="sidebar-title">{{ displayName }}</h2>
          <div class="sidebar-actions">
            <button class="search-btn" @click="showSearch = true" title="Search">
              Search
            </button>
            <button class="collapse-btn" @click="sidebarCollapsed = true" title="Collapse sidebar">
              &#x2039;
            </button>
          </div>
        </div>
        <div v-if="isBranch" class="branch-badge" :title="'Branch of ' + repoInfo.parentRepo">
          &#x2937; Branch: {{ repoInfo.branchName }}
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
            <router-link to="/" class="breadcrumb-all-docs" title="All Documentation">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8M8 11h6"/></svg>
            </router-link>
            <span class="breadcrumb-sep">/</span>
            <router-link :to="'/view/' + repoName + '/index.md'" class="breadcrumb-home" title="Home">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L1 7h2v6h4V9h2v4h4V7h2L8 1z"/></svg>
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
          <button class="theme-toggle" @click="onToggleTheme" :title="currentTheme === 'dark' ? 'Switch to Day Mode' : 'Switch to Night Mode'">
            {{ currentTheme === 'dark' ? '&#x2600;' : '&#x263E;' }}
          </button>
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
import { getTheme, toggleTheme } from '@/utils/theme'

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
      titleMap: {},
      repoInfo: null,
      currentTheme: getTheme()
    }
  },
  computed: {
    repoName() {
      return this.$route.params.repoName
    },
    displayName() {
      return this.formatRepoName(this.repoName)
    },
    currentFile() {
      const pathMatch = this.$route.params.pathMatch
      if (Array.isArray(pathMatch)) {
        return pathMatch.join('/')
      }
      return pathMatch || ''
    },
    isBranch() {
      return this.repoInfo && this.repoInfo.type === 'branch'
    },
    breadcrumbs() {
      if (!this.currentFile) return []
      const parts = this.currentFile.split('/')
      const crumbs = []
      const viewBase = '/view/' + this.repoName + '/'

      if (parts.length === 1 && parts[0] === 'index.md') return []

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

      const filePath = this.currentFile
      const fileName = parts[parts.length - 1]
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
        this.fetchRepoInfo()
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
    onToggleTheme() {
      this.currentTheme = toggleTheme()
    },
    async fetchRepoInfo() {
      if (!this.repoName) return
      try {
        const response = await apiFetch('/api/repos/' + this.repoName + '/info')
        if (response.ok) {
          this.repoInfo = await response.json()
        }
      } catch {
        // ignore
      }
    },
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
    formatRepoName(name) {
      return (name || '')
        .replace(/\bdocumentation[-_]?/gi, '')
        .replace(/[-_]+/g, ' ')
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase())
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
.viewer-layout { display: flex; min-height: 100vh; }
.viewer-sidebar { width: 280px; min-width: 280px; background: var(--bg-surface); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; overflow-y: auto; height: 100vh; position: sticky; top: 0; }
.sidebar-header { padding: 16px; border-bottom: 1px solid var(--border-color); }
.sidebar-title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.sidebar-title { font-size: 14px; font-weight: 600; margin: 0; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.branch-badge { font-size: 10px; padding: 2px 6px; margin-top: 8px; background: var(--color-badge-bg); color: var(--color-badge-text); border-radius: 3px; display: inline-block; }
.sidebar-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.search-btn { padding: 4px 12px; font-size: 12px; background: var(--bg-surface-hover); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; color: var(--text-tertiary); }
.search-btn:hover { background: var(--bg-surface-active); }
.collapse-btn, .expand-btn { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: var(--bg-surface-hover); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; color: var(--text-tertiary); font-size: 16px; font-weight: bold; line-height: 1; flex-shrink: 0; }
.collapse-btn:hover, .expand-btn:hover { background: var(--bg-surface-active); }
.viewer-content { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.content-header { padding: 12px 24px; border-bottom: 1px solid var(--border-color); background: var(--bg-surface); display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10; }
.content-header-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
.content-header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.breadcrumb { display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--text-muted); min-width: 0; }
.breadcrumb-all-docs { display: inline-flex; align-items: center; color: var(--text-muted); text-decoration: none; flex-shrink: 0; padding: 4px; border-radius: 4px; }
.breadcrumb-all-docs:hover { color: var(--color-primary); background: var(--bg-surface-hover); }
.breadcrumb-home { display: inline-flex; align-items: center; color: var(--text-muted); text-decoration: none; flex-shrink: 0; padding: 4px; border-radius: 4px; }
.breadcrumb-home:hover { color: var(--color-primary); background: var(--bg-surface-hover); }
.breadcrumb-sep { color: var(--border-medium); flex-shrink: 0; }
.breadcrumb-link { color: var(--color-primary); text-decoration: none; white-space: nowrap; }
.breadcrumb-link:hover { text-decoration: underline; }
.breadcrumb-current { color: var(--text-tertiary); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.download-pdf-btn { padding: 4px 12px; font-size: 12px; background: var(--bg-surface-hover); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; color: var(--text-tertiary); }
.download-pdf-btn:hover { background: var(--bg-surface-active); }
.pdf-building { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-faint); }
.edit-link { padding: 4px 12px; font-size: 12px; background: var(--color-primary); color: #fff; border-radius: 4px; text-decoration: none; }
.edit-link:hover { background: var(--color-primary-hover); }
.content-body { flex: 1; padding: 24px 48px; max-width: 900px; }
.loading, .error { padding: 48px; text-align: center; color: var(--text-muted); }
.error { color: var(--color-error); }
</style>
