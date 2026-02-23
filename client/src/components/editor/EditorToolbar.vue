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
    <div class="toolbar-spacer"></div>
    <button
      class="toolbar-btn toolbar-delete"
      title="Delete this file"
      @click="$emit('delete')"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
    </button>
  </div>
</template>

<script>
export default {
  name: 'EditorToolbar',
  emits: ['action', 'delete'],
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
  background: var(--bg-surface-alt);
  border-bottom: 1px solid var(--border-color);
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
  color: var(--text-tertiary);
  transition: all 0.1s;
}

.toolbar-btn:hover {
  background: var(--bg-surface-hover);
  border-color: var(--border-color);
}

.toolbar-btn:active {
  background: var(--bg-surface-active);
}

.toolbar-spacer {
  flex: 1;
}

.toolbar-delete {
  color: var(--text-faint);
}

.toolbar-delete:hover {
  color: var(--color-error);
  background: var(--color-error-bg);
  border-color: var(--color-error);
}
</style>
