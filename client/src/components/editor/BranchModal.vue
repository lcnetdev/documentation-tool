<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card">
      <h3 class="modal-title">Create Branch</h3>
      <p class="modal-desc">
        Create a working copy of <strong>{{ repoName }}</strong> to edit independently.
      </p>
      <div class="form-group">
        <label for="branch-name">Branch Name</label>
        <input
          id="branch-name"
          v-model="branchName"
          type="text"
          placeholder="e.g. Draft V2"
          class="form-input"
          @keydown.enter="onCreate"
        />
        <div v-if="branchName.trim()" class="form-hint">
          Directory: {{ repoName }}--{{ normalized }}
        </div>
        <div v-if="validationError" class="form-error">{{ validationError }}</div>
      </div>
      <div v-if="serverError" class="form-error server-error">{{ serverError }}</div>
      <div class="modal-actions">
        <button class="btn-cancel" @click="$emit('close')">Cancel</button>
        <button class="btn-create" :disabled="creating" @click="onCreate">
          {{ creating ? 'Creating...' : 'Create Branch' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { getAuthHeader } from '@/stores/auth'
import { apiFetch } from '@/utils/api'

export default {
  name: 'BranchModal',
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
  emits: ['close', 'created'],
  data() {
    return {
      branchName: '',
      creating: false,
      serverError: ''
    }
  },
  computed: {
    normalized() {
      return this.branchName.trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60)
    },
    validationError() {
      const name = this.branchName.trim()
      if (!name) return ''
      if (name.includes('..')) return 'Name cannot contain ".."'
      if (name.includes('/') || name.includes('\\')) return 'Name cannot contain path separators'
      if (this.normalized.length < 2) return 'Name must be at least 2 characters'
      return ''
    }
  },
  watch: {
    visible(val) {
      if (val) {
        this.branchName = ''
        this.serverError = ''
      }
    }
  },
  methods: {
    async onCreate() {
      const name = this.branchName.trim()
      if (!name || this.validationError) return

      this.creating = true
      this.serverError = ''
      try {
        const response = await apiFetch(
          '/api/repos/' + this.repoName + '/branch',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': getAuthHeader()
            },
            body: JSON.stringify({ branchName: name })
          }
        )
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.details || data.error || 'Failed to create branch')
        }
        const result = await response.json()
        this.$emit('created', result)
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
  max-width: 420px;
  box-shadow: var(--shadow-lg);
}

.modal-title {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-desc {
  margin: 0 0 16px 0;
  font-size: 13px;
  color: var(--text-muted);
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

.form-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
  background: var(--bg-surface);
  color: var(--text-primary);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(74, 144, 217, 0.15);
}

.form-hint {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-faint);
  font-family: 'SF Mono', SFMono-Regular, Menlo, monospace;
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

.btn-create {
  padding: 6px 16px;
  font-size: 13px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn-create:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-create:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
