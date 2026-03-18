<template>
  <nav class="nav-sidebar">
    <div v-if="loading" class="sidebar-loading">Loading...</div>
    <div v-else-if="error" class="sidebar-error">{{ error }}</div>
    <ul v-else class="tree-root">
      <NavSidebarItem
        v-for="item in visibleTree"
        :key="item.path"
        :item="item"
        :repo-name="repoName"
        :current-file="currentFile"
        :expanded-dirs="expandedDirs"
        @toggle-dir="toggleDir"
        @navigate="onNavigate"
      />
    </ul>
  </nav>
</template>

<script>
import NavSidebarItem from './NavSidebarItem.vue'
import { apiFetch } from '@/utils/api'

export default {
  name: 'NavSidebar',
  components: {
    NavSidebarItem
  },
  props: {
    repoName: {
      type: String,
      required: true
    },
    currentFile: {
      type: String,
      default: ''
    }
  },
  emits: ['navigate'],
  computed: {
    visibleTree() {
      return this.filterHidden(this.tree)
    }
  },
  data() {
    return {
      tree: [],
      loading: false,
      error: null,
      expandedDirs: {}
    }
  },
  watch: {
    repoName() {
      this.fetchTree()
    },
    currentFile() {
      this.expandToCurrentFile()
    }
  },
  mounted() {
    this.fetchTree()
  },
  methods: {
    async fetchTree() {
      if (!this.repoName) return
      this.loading = true
      this.error = null
      try {
        const response = await apiFetch('/api/repos/' + this.repoName + '/tree')
        if (!response.ok) {
          throw new Error('Failed to load file tree')
        }
        this.tree = await response.json()
        this.expandToCurrentFile()
      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },
    expandToCurrentFile() {
      if (!this.currentFile) return
      const parts = this.currentFile.split('/')
      let path = ''
      for (let i = 0; i < parts.length - 1; i++) {
        path = path ? path + '/' + parts[i] : parts[i]
        this.expandedDirs[path] = true
      }
    },
    toggleDir(dirPath) {
      if (this.expandedDirs[dirPath]) {
        delete this.expandedDirs[dirPath]
      } else {
        this.expandedDirs[dirPath] = true
      }
      this.expandedDirs = { ...this.expandedDirs }
    },
    onNavigate(filePath) {
      this.$emit('navigate', filePath)
    },
    filterHidden(items) {
      if (!items) return []
      return items
        .filter(item => item.name !== 'hidden')
        .map(item => {
          if (item.type === 'directory' && item.children) {
            return { ...item, children: this.filterHidden(item.children) }
          }
          return item
        })
    }
  }
}
</script>

<style scoped>
.nav-sidebar {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.sidebar-loading,
.sidebar-error {
  padding: 16px;
  font-size: 13px;
  color: var(--text-muted);
}

.sidebar-error {
  color: var(--color-error);
}

.tree-root {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
