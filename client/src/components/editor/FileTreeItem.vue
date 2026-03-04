<template>
  <li class="tree-item">
    <div
      v-if="item.type === 'directory'"
      class="tree-label tree-dir"
      :class="{ expanded: isExpanded }"
      @click="$emit('toggle-dir', item.path)"
    >
      <span class="tree-arrow">{{ isExpanded ? '&#9662;' : '&#9656;' }}</span>
      <span class="tree-icon folder-icon"></span>
      <span class="tree-name">{{ item.title || item.name }}</span>
      <button class="tree-action-btn tree-rename-btn" title="Rename directory" @click.stop="$emit('rename-dir', item.path)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="tree-action-btn tree-delete-btn" title="Delete directory" @click.stop="$emit('delete-dir', item.path)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
    <div
      v-else
      class="tree-label tree-file"
      :class="{ active: item.path === currentFile }"
      draggable="true"
      @click="$emit('select', item.path)"
      @dragstart="onDragStart"
    >
      <span class="tree-icon file-icon"></span>
      <span class="tree-name">{{ item.title || item.name }}</span>
    </div>
    <ul v-if="item.type === 'directory' && isExpanded && item.children" class="tree-children">
      <FileTreeItem
        v-for="child in item.children"
        :key="child.path"
        :item="child"
        :current-file="currentFile"
        :expanded-dirs="expandedDirs"
        @select="$emit('select', $event)"
        @toggle-dir="$emit('toggle-dir', $event)"
        @delete-dir="$emit('delete-dir', $event)"
        @rename-dir="$emit('rename-dir', $event)"
      />
    </ul>
  </li>
</template>

<script>
export default {
  name: 'FileTreeItem',
  props: {
    item: {
      type: Object,
      required: true
    },
    currentFile: {
      type: String,
      default: ''
    },
    expandedDirs: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['select', 'toggle-dir', 'delete-dir', 'rename-dir'],
  computed: {
    isExpanded() {
      return !!this.expandedDirs[this.item.path]
    }
  },
  methods: {
    onDragStart(e) {
      e.dataTransfer.setData('text/plain', this.item.path)
      e.dataTransfer.setData('application/x-file-path', this.item.path)
      e.dataTransfer.effectAllowed = 'copy'
    }
  }
}
</script>

<style scoped>
.tree-item {
  list-style: none;
}

.tree-label {
  display: flex;
  align-items: center;
  padding: 3px 12px 3px 8px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-tertiary);
  text-decoration: none;
  transition: background-color 0.1s;
  user-select: none;
}

.tree-label:hover {
  background: var(--bg-surface-hover);
}

.tree-file.active {
  background: var(--color-primary-bg);
  color: var(--color-primary-dark);
  font-weight: 500;
}

.tree-arrow {
  width: 14px;
  font-size: 9px;
  color: var(--text-faint);
  flex-shrink: 0;
}

.tree-icon {
  width: 14px;
  height: 14px;
  margin-right: 5px;
  flex-shrink: 0;
}

.folder-icon::before {
  content: '\1F4C1';
  font-size: 11px;
}

.file-icon::before {
  content: '\1F4C4';
  font-size: 11px;
}

.tree-file .tree-icon {
  margin-left: 14px;
}

.tree-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.tree-action-btn {
  display: none;
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  padding: 2px 4px;
  flex-shrink: 0;
  line-height: 1;
}

.tree-rename-btn {
  margin-left: auto;
}

.tree-rename-btn:hover {
  color: var(--color-primary);
}

.tree-delete-btn:hover {
  color: var(--color-error, #e53e3e);
}

.tree-dir:hover .tree-action-btn {
  display: block;
}

.tree-children {
  list-style: none;
  margin: 0;
  padding: 0 0 0 12px;
}
</style>
