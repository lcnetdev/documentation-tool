<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card">
      <h3 class="modal-title">Move File</h3>

      <div class="form-group">
        <label>File to Move</label>
        <select v-model="selectedFile" class="form-select">
          <option value="" disabled>Select a file...</option>
          <option v-for="f in files" :key="f.path" :value="f.path">{{ f.path }}</option>
        </select>
      </div>

      <div class="form-group">
        <label>Move To</label>
        <ul class="dir-list">
          <li
            class="dir-item"
            :class="{ selected: selectedDir === '' }"
            @click="selectedDir = ''"
          >
            <span class="dir-icon">&#x1F4C1;</span>
            <span class="dir-name">(root)</span>
          </li>
          <li
            v-for="dir in directories"
            :key="dir.path"
            class="dir-item"
            :class="{ selected: selectedDir === dir.path, disabled: isCurrentDir(dir.path) }"
            :style="{ paddingLeft: (12 + dir.depth * 16) + 'px' }"
            @click="!isCurrentDir(dir.path) && (selectedDir = dir.path)"
          >
            <span class="dir-icon">&#x1F4C1;</span>
            <span class="dir-name">{{ dir.name }}</span>
            <span v-if="isCurrentDir(dir.path)" class="dir-current">(current)</span>
          </li>
        </ul>
      </div>

      <div v-if="serverError" class="form-error server-error">{{ serverError }}</div>

      <div class="modal-actions">
        <button class="btn-cancel" @click="$emit('close')">Cancel</button>
        <button
          class="btn-move"
          :disabled="!canMove || moving"
          @click="onMove"
        >
          {{ moving ? 'Moving...' : 'Move' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { getAuthHeader } from '@/stores/auth'
import { apiFetch } from '@/utils/api'

export default {
  name: 'MoveModal',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    repoName: {
      type: String,
      required: true
    }
  },
  emits: ['close', 'moved'],
  data() {
    return {
      tree: [],
      selectedFile: '',
      selectedDir: '',
      moving: false,
      serverError: ''
    }
  },
  computed: {
    files() {
      const result = []
      const walk = (items, prefix) => {
        for (const item of items) {
          if (item.type === 'file') {
            result.push({ path: prefix ? prefix + '/' + item.name : item.name })
          } else if (item.type === 'directory' && item.children) {
            walk(item.children, prefix ? prefix + '/' + item.name : item.name)
          }
        }
      }
      walk(this.tree, '')
      return result
    },
    directories() {
      const result = []
      const walk = (items, prefix, depth) => {
        for (const item of items) {
          if (item.type === 'directory') {
            const dirPath = prefix ? prefix + '/' + item.name : item.name
            result.push({ path: dirPath, name: item.title || item.name, depth })
            if (item.children) {
              walk(item.children, dirPath, depth + 1)
            }
          }
        }
      }
      walk(this.tree, '', 0)
      return result
    },
    currentDir() {
      if (!this.selectedFile) return null
      const lastSlash = this.selectedFile.lastIndexOf('/')
      return lastSlash === -1 ? '' : this.selectedFile.substring(0, lastSlash)
    },
    canMove() {
      if (!this.selectedFile) return false
      if (this.selectedDir === null || this.selectedDir === undefined) return false
      if (this.isCurrentDir(this.selectedDir)) return false
      return true
    }
  },
  watch: {
    visible(val) {
      if (val) {
        this.selectedFile = ''
        this.selectedDir = ''
        this.serverError = ''
        this.fetchTree()
      }
    }
  },
  methods: {
    isCurrentDir(dirPath) {
      return this.currentDir !== null && dirPath === this.currentDir
    },
    async fetchTree() {
      try {
        const response = await apiFetch('/api/repos/' + this.repoName + '/tree')
        if (response.ok) {
          this.tree = await response.json()
        }
      } catch {
        // ignore
      }
    },
    async onMove() {
      if (!this.canMove) return

      this.moving = true
      this.serverError = ''
      try {
        const response = await apiFetch(
          '/api/repos/' + this.repoName + '/move',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': getAuthHeader()
            },
            body: JSON.stringify({
              filePath: this.selectedFile,
              destinationDir: this.selectedDir
            })
          }
        )
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.details || data.error || 'Failed to move file')
        }
        const result = await response.json()
        this.$emit('moved', result)
        this.$emit('close')
      } catch (err) {
        this.serverError = err.message
      } finally {
        this.moving = false
      }
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-card {
  background: var(--bg-surface);
  border-radius: 8px;
  padding: 24px;
  width: 100%;
  max-width: 480px;
  box-shadow: var(--shadow-lg);
}

.modal-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary);
}

.form-select {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
  background: var(--bg-surface);
  color: var(--text-primary);
}

.form-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(74, 144, 217, 0.15);
}

.dir-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  max-height: 240px;
  overflow-y: auto;
}

.dir-item {
  display: flex;
  align-items: center;
  padding: 5px 12px;
  font-size: 12px;
  color: var(--text-tertiary);
  cursor: pointer;
  user-select: none;
}

.dir-item:hover:not(.disabled) {
  background: var(--bg-surface-hover);
}

.dir-item.selected {
  background: var(--color-primary-bg);
  color: var(--color-primary-dark);
  font-weight: 500;
}

.dir-item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dir-icon {
  font-size: 11px;
  margin-right: 6px;
  flex-shrink: 0;
}

.dir-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dir-current {
  margin-left: 6px;
  font-size: 10px;
  color: var(--text-faint);
  font-style: italic;
}

.form-error {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-error);
}

.server-error {
  margin-bottom: 12px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.btn-cancel {
  padding: 6px 16px;
  font-size: 13px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-tertiary);
}

.btn-cancel:hover {
  background: var(--bg-surface-alt);
}

.btn-move {
  padding: 6px 16px;
  font-size: 13px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn-move:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-move:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
