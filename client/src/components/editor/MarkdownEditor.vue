<template>
  <div class="markdown-editor" @drop.prevent="onDrop" @dragover.prevent="onDragOver" @dragleave="onDragLeave">
    <div class="editor-container" :class="{ 'drag-over': isDragOver }">
      <div class="line-numbers" ref="lineNumbers">
        <div
          v-for="n in lineCount"
          :key="n"
          class="line-number"
        >{{ n }}</div>
      </div>
      <textarea
        ref="textarea"
        class="editor-textarea"
        :value="modelValue"
        @input="onInput"
        @keydown="onKeydown"
        @scroll="syncScroll"
        @paste="onPaste"
        spellcheck="false"
      ></textarea>
    </div>
  </div>
</template>

<script>
import { computeRelativePath } from '@/utils/relativePath'

export default {
  name: 'MarkdownEditor',
  props: {
    modelValue: {
      type: String,
      default: ''
    }
  },
  emits: ['update:modelValue', 'image-drop', 'image-paste'],
  data() {
    return {
      isDragOver: false
    }
  },
  computed: {
    lineCount() {
      if (!this.modelValue) return 1
      return this.modelValue.split('\n').length
    }
  },
  methods: {
    onInput(e) {
      this.$emit('update:modelValue', e.target.value)
    },
    onKeydown(e) {
      if (e.key === 'Tab') {
        e.preventDefault()
        const textarea = this.$refs.textarea
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const value = this.modelValue
        const newValue = value.substring(0, start) + '  ' + value.substring(end)
        this.$emit('update:modelValue', newValue)
        this.$nextTick(() => {
          textarea.selectionStart = start + 2
          textarea.selectionEnd = start + 2
        })
      }
    },
    onDrop(e) {
      this.isDragOver = false
      const filePath = e.dataTransfer.getData('application/x-file-path')
      if (filePath) {
        // File dragged from FileTree
        const isImage = /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(filePath)
        // Get current file from parent - walk up to find EditorLayout
        const editorLayout = this.findEditorLayout()
        const currentFile = editorLayout ? editorLayout.currentFile : ''

        if (isImage && currentFile) {
          const relativePath = computeRelativePath(currentFile, filePath)
          this.insertAtCursor('![image](' + relativePath + ')')
        } else if (currentFile) {
          const relativePath = computeRelativePath(currentFile, filePath)
          const name = filePath.split('/').pop()
          this.insertAtCursor('[' + name + '](' + relativePath + ')')
        }
        return
      }

      // Image file dropped from OS
      const files = e.dataTransfer.files
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          if (files[i].type.startsWith('image/')) {
            this.$emit('image-drop', files[i])
            return
          }
        }
      }
    },
    onDragOver(e) {
      this.isDragOver = true
      e.dataTransfer.dropEffect = 'copy'
    },
    onDragLeave() {
      this.isDragOver = false
    },
    onPaste(e) {
      const items = e.clipboardData && e.clipboardData.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault()
          const file = items[i].getAsFile()
          if (file) {
            this.$emit('image-paste', file)
          }
          return
        }
      }
    },
    insertAtCursor(text) {
      const textarea = this.$refs.textarea
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const value = this.modelValue
      const newValue = value.substring(0, start) + text + value.substring(end)
      this.$emit('update:modelValue', newValue)
      this.$nextTick(() => {
        textarea.selectionStart = start + text.length
        textarea.selectionEnd = start + text.length
        textarea.focus()
      })
    },
    syncScroll() {
      const textarea = this.$refs.textarea
      const lineNumbers = this.$refs.lineNumbers
      if (textarea && lineNumbers) {
        lineNumbers.scrollTop = textarea.scrollTop
      }
    },
    findEditorLayout() {
      let parent = this.$parent
      while (parent) {
        if (parent.currentFile !== undefined) {
          return parent
        }
        parent = parent.$parent
      }
      return null
    }
  }
}
</script>

<style scoped>
.markdown-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.editor-container {
  flex: 1;
  display: flex;
  position: relative;
  min-height: 0;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}

.editor-container.drag-over {
  border-color: #4a90d9;
  background: #ebf8ff;
}

.line-numbers {
  width: 48px;
  background: #f7fafc;
  border-right: 1px solid #e2e8f0;
  padding: 12px 0;
  overflow: hidden;
  flex-shrink: 0;
}

.line-number {
  padding: 0 8px;
  text-align: right;
  font-family: 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #a0aec0;
  height: 20.8px;
}

.editor-textarea {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  padding: 12px 16px;
  font-family: 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #1a202c;
  background: #fff;
  tab-size: 2;
  white-space: pre;
  overflow-wrap: normal;
  overflow-x: auto;
  overflow-y: auto;
  min-height: 0;
}

.editor-textarea::placeholder {
  color: #cbd5e0;
}
</style>
