<template>
  <div class="file-tree">
    <div v-if="loading" class="tree-loading">Loading...</div>
    <div v-else-if="error" class="tree-error">{{ error }}</div>
    <ul v-else class="tree-root">
      <FileTreeItem
        v-for="item in tree"
        :key="item.path"
        :item="item"
        :current-file="currentFile"
        :expanded-dirs="expandedDirs"
        @select="$emit('select', $event)"
        @toggle-dir="toggleDir"
        @delete-dir="$emit('delete-dir', $event)"
      />
    </ul>
  </div>
</template>

<script>
import FileTreeItem from './FileTreeItem.vue'
import { apiFetch } from '@/utils/api'

export default {
  name: 'FileTree',
  components: {
    FileTreeItem
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
  emits: ['select', 'delete-dir'],
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
      this.expandedDirs = { ...this.expandedDirs }
    },
    toggleDir(dirPath) {
      if (this.expandedDirs[dirPath]) {
        delete this.expandedDirs[dirPath]
      } else {
        this.expandedDirs[dirPath] = true
      }
      this.expandedDirs = { ...this.expandedDirs }
    }
  }
}
</script>

<style scoped>
.file-tree {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.tree-loading,
.tree-error {
  padding: 16px;
  font-size: 13px;
  color: var(--text-muted);
}

.tree-error {
  color: var(--color-error);
}

.tree-root {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
