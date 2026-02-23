<template>
  <div class="save-bar">
    <div class="save-bar-inner">
      <input
        v-model="commitMessage"
        type="text"
        class="commit-input"
        placeholder="Commit message (optional)"
        :disabled="saving"
        @keydown.enter="onSave"
      />
      <button
        class="save-btn"
        :disabled="!hasChanges || saving"
        @click="onSave"
      >
        <span v-if="saving" class="saving-spinner"></span>
        {{ saving ? 'Saving...' : 'Save' }}
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SaveBar',
  props: {
    hasChanges: {
      type: Boolean,
      default: false
    },
    saving: {
      type: Boolean,
      default: false
    }
  },
  emits: ['save'],
  data() {
    return {
      commitMessage: ''
    }
  },
  methods: {
    onSave() {
      if (!this.hasChanges || this.saving) return
      this.$emit('save', this.commitMessage)
      this.commitMessage = ''
    }
  }
}
</script>

<style scoped>
.save-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--savebar-bg);
  border-top: 1px solid var(--savebar-border);
  z-index: 100;
}

.save-bar-inner {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  gap: 12px;
  max-width: 100%;
}

.commit-input {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid var(--savebar-input-border);
  border-radius: 4px;
  background: var(--savebar-input-bg);
  color: var(--savebar-input-color);
  font-size: 13px;
  outline: none;
}

.commit-input:focus {
  border-color: var(--color-primary);
}

.commit-input::placeholder {
  color: var(--text-muted);
}

.save-btn {
  padding: 6px 20px;
  background: var(--color-success);
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.save-btn:hover:not(:disabled) {
  background: var(--color-success-hover);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.saving-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
