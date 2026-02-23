<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card">
      <h3 class="modal-title">Merge Branch</h3>
      <div class="merge-info">
        <p>
          Merge branch <strong>{{ branchName }}</strong> into
          <strong>{{ formatName(parentRepo) }}</strong>?
        </p>
        <p class="merge-warning">
          This will replace all content files in the original repository with the
          files from this branch. A backup will be created automatically before merging.
        </p>
        <p class="merge-warning">
          After merging, this branch will be deleted.
        </p>
      </div>
      <div v-if="serverError" class="form-error server-error">{{ serverError }}</div>
      <div class="modal-actions">
        <button class="btn-cancel" @click="$emit('close')">Cancel</button>
        <button class="btn-merge" :disabled="merging" @click="onMerge">
          {{ merging ? 'Merging...' : 'Merge into Original' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { getAuthHeader } from '@/stores/auth'
import { apiFetch } from '@/utils/api'

export default {
  name: 'MergeModal',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    repoName: {
      type: String,
      required: true
    },
    parentRepo: {
      type: String,
      default: ''
    },
    branchName: {
      type: String,
      default: ''
    }
  },
  emits: ['close', 'merged'],
  data() {
    return {
      merging: false,
      serverError: ''
    }
  },
  watch: {
    visible(val) {
      if (val) {
        this.serverError = ''
      }
    }
  },
  methods: {
    formatName(name) {
      return (name || '')
        .replace(/\bdocumentation[-_]?/gi, '')
        .replace(/[-_]+/g, ' ')
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase())
    },
    async onMerge() {
      this.merging = true
      this.serverError = ''
      try {
        const response = await apiFetch(
          '/api/repos/' + this.repoName + '/merge',
          {
            method: 'POST',
            headers: {
              'Authorization': getAuthHeader()
            }
          }
        )
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to merge')
        }
        const result = await response.json()
        this.$emit('merged', result)
        this.$emit('close')
      } catch (err) {
        this.serverError = err.message
      } finally {
        this.merging = false
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
  max-width: 460px;
  box-shadow: var(--shadow-lg);
}

.modal-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.merge-info p {
  margin: 0 0 10px 0;
  font-size: 13px;
  color: var(--text-tertiary);
  line-height: 1.5;
}

.merge-warning {
  color: var(--color-warning-hover) !important;
  font-size: 12px !important;
}

.form-error {
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

.btn-merge {
  padding: 6px 16px;
  font-size: 13px;
  background: var(--color-warning);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn-merge:hover:not(:disabled) {
  background: var(--color-warning-hover);
}

.btn-merge:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
