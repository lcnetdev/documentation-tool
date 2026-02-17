<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card">
      <h3 class="modal-title">Create New</h3>
      <div class="type-toggle">
        <button
          class="type-btn"
          :class="{ active: createType === 'file' }"
          @click="createType = 'file'"
        >File</button>
        <button
          class="type-btn"
          :class="{ active: createType === 'directory' }"
          @click="createType = 'directory'"
        >Directory</button>
      </div>
      <div class="form-group">
        <label for="create-parent">Parent Directory</label>
        <select id="create-parent" v-model="parentDir" class="form-select">
          <option value="">(root)</option>
          <option v-for="dir in directories" :key="dir" :value="dir">{{ dir }}</option>
        </select>
      </div>
      <div class="form-group">
        <label for="create-name">{{ createType === 'file' ? 'File Name' : 'Directory Name' }}</label>
        <input
          id="create-name"
          v-model="itemName"
          type="text"
          :placeholder="createType === 'file' ? 'new-page.md' : 'new-section'"
          class="form-input"
          @keydown.enter="onCreate"
        />
        <div v-if="validationError" class="form-error">{{ validationError }}</div>
      </div>
      <div v-if="serverError" class="form-error server-error">{{ serverError }}</div>
      <div class="modal-actions">
        <button class="btn-cancel" @click="$emit('close')">Cancel</button>
        <button class="btn-create" :disabled="creating" @click="onCreate">
          {{ creating ? 'Creating...' : 'Create' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { getAuthHeader } from '@/stores/auth'
import { apiFetch } from '@/utils/api'

export default {
  name: 'CreateModal',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    repoName: {
      type: String,
      required: true
    },
  },
  emits: ['close', 'created'],
  data() {
    return {
      createType: 'file',
      parentDir: '',
      itemName: '',
      creating: false,
      serverError: '',
      tree: []
    }
  },
  computed: {
    directories() {
      const dirs = []
      const walk = (items, prefix) => {
        for (const item of items) {
          if (item.type === 'directory') {
            const dirPath = prefix ? prefix + '/' + item.name : item.name
            dirs.push(dirPath)
            if (item.children) {
              walk(item.children, dirPath)
            }
          }
        }
      }
      walk(this.tree, '')
      return dirs
    },
    validationError() {
      if (!this.itemName) return ''
      const name = this.itemName.trim()
      if (name.includes('..')) return 'Name cannot contain ".."'
      if (name.includes('/') || name.includes('\\')) return 'Name cannot contain path separators'
      if (this.createType === 'file' && !name.endsWith('.md') && name.includes('.')) {
        return 'File must have .md extension'
      }
      return ''
    }
  },
  watch: {
    visible(val) {
      if (val) {
        this.itemName = ''
        this.parentDir = ''
        this.createType = 'file'
        this.serverError = ''
        this.fetchTree()
      }
    }
  },
  methods: {
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
    async onCreate() {
      const name = this.itemName.trim()
      if (!name) return
      if (this.validationError) return

      let finalName = name
      if (this.createType === 'file' && !finalName.endsWith('.md')) {
        finalName = finalName + '.md'
      }

      const fullPath = this.parentDir ? this.parentDir + '/' + finalName : finalName

      this.creating = true
      this.serverError = ''
      try {
        const response = await apiFetch(
          '/api/repos/' + this.repoName + '/create',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': getAuthHeader()
            },
            body: JSON.stringify({
              path: fullPath,
              type: this.createType
            })
          }
        )
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to create')
        }
        this.$emit('created', { path: fullPath, type: this.createType })
        this.$emit('close')
      } catch (err) {
        this.serverError = err.message
      } finally {
        this.creating = false
      }
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-card {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
}

.modal-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1a202c;
}

.type-toggle {
  display: flex;
  gap: 0;
  margin-bottom: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.type-btn {
  flex: 1;
  padding: 6px 12px;
  font-size: 13px;
  border: none;
  background: #fff;
  color: #4a5568;
  cursor: pointer;
  font-weight: 500;
}

.type-btn.active {
  background: #4a90d9;
  color: #fff;
}

.type-btn:not(.active):hover {
  background: #edf2f7;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #4a5568;
}

.form-select,
.form-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
  background: #fff;
  color: #1a202c;
}

.form-select:focus,
.form-input:focus {
  outline: none;
  border-color: #4a90d9;
  box-shadow: 0 0 0 2px rgba(74, 144, 217, 0.15);
}

.form-error {
  margin-top: 4px;
  font-size: 12px;
  color: #e53e3e;
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
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  cursor: pointer;
  color: #4a5568;
}

.btn-cancel:hover {
  background: #f7fafc;
}

.btn-create {
  padding: 6px 16px;
  font-size: 13px;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn-create:hover:not(:disabled) {
  background: #357abd;
}

.btn-create:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
