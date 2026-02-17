<template>
  <div class="editor-toolbar">
    <button
      v-for="btn in buttons"
      :key="btn.label"
      class="toolbar-btn"
      :title="btn.label"
      @click="$emit('action', btn.type, btn.payload)"
    >
      {{ btn.icon }}
    </button>
  </div>
</template>

<script>
export default {
  name: 'EditorToolbar',
  emits: ['action'],
  data() {
    return {
      buttons: [
        { label: 'Heading 1', icon: 'H1', type: 'heading', payload: '# ' },
        { label: 'Heading 2', icon: 'H2', type: 'heading', payload: '## ' },
        { label: 'Heading 3', icon: 'H3', type: 'heading', payload: '### ' },
        { label: 'Bold', icon: 'B', type: 'wrap', payload: '**' },
        { label: 'Italic', icon: 'I', type: 'wrap', payload: '*' },
        { label: 'Strikethrough', icon: 'S', type: 'wrap', payload: '~~' },
        { label: 'Link', icon: '\uD83D\uDD17', type: 'insert', payload: '[text](url)' },
        { label: 'Image', icon: '\uD83D\uDDBC', type: 'insert', payload: '![alt](url)' },
        { label: 'Unordered List', icon: '\u2022', type: 'line', payload: '- ' },
        { label: 'Ordered List', icon: '1.', type: 'line', payload: '1. ' },
        { label: 'Blockquote', icon: '\u275D', type: 'line', payload: '> ' },
        { label: 'Code Block', icon: '{ }', type: 'block', payload: '```\n\n```' },
        { label: 'Horizontal Rule', icon: '\u2015', type: 'insert', payload: '\n---\n' }
      ]
    }
  }
}
</script>

<style scoped>
.editor-toolbar {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background: #f7fafc;
  border-bottom: 1px solid #e2e8f0;
  gap: 2px;
  flex-wrap: wrap;
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 28px;
  padding: 0 6px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #4a5568;
  transition: all 0.1s;
}

.toolbar-btn:hover {
  background: #edf2f7;
  border-color: #e2e8f0;
}

.toolbar-btn:active {
  background: #e2e8f0;
}
</style>
