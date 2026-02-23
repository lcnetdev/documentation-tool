<template>
  <div
    class="image-drop-zone"
    :class="{ 'drop-active': isDragOver }"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <slot></slot>
    <div v-if="isDragOver" class="drop-indicator">
      <div class="drop-indicator-text">Drop image to upload</div>
    </div>
  </div>
</template>

<script>
import { getAuthHeader } from '@/stores/auth'
import { computeRelativePath } from '@/utils/relativePath'
import { apiFetch } from '@/utils/api'

export default {
  name: 'ImageDropZone',
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
  emits: ['image-uploaded'],
  data() {
    return {
      isDragOver: false
    }
  },
  methods: {
    onDragOver(e) {
      // Only show indicator for file drops (not internal file tree drags)
      if (e.dataTransfer.types.includes('Files')) {
        this.isDragOver = true
        e.dataTransfer.dropEffect = 'copy'
      }
    },
    onDragLeave() {
      this.isDragOver = false
    },
    async onDrop(e) {
      this.isDragOver = false
      const files = e.dataTransfer.files
      if (!files || files.length === 0) return

      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
          await this.uploadImage(files[i])
          return
        }
      }
    },
    async uploadImage(file) {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('currentFile', this.currentFile)

      try {
        const response = await apiFetch(
          '/api/repos/' + this.repoName + '/images/upload',
          {
            method: 'POST',
            headers: {
              'Authorization': getAuthHeader()
            },
            body: formData
          }
        )
        if (!response.ok) {
          throw new Error('Failed to upload image')
        }
        const data = await response.json()
        if (data.path) {
          const relativePath = computeRelativePath(this.currentFile, data.path)
          this.$emit('image-uploaded', relativePath)
        } else if (data.relativePath) {
          this.$emit('image-uploaded', data.relativePath)
        }
      } catch (err) {
        alert('Image upload failed: ' + err.message)
      }
    }
  }
}
</script>

<style scoped>
.image-drop-zone {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.drop-indicator {
  position: absolute;
  inset: 0;
  background: var(--drop-bg);
  border: 2px dashed var(--color-primary);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  pointer-events: none;
}

.drop-indicator-text {
  padding: 12px 24px;
  background: var(--drop-text-bg);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-primary);
  box-shadow: var(--shadow-md);
}
</style>
