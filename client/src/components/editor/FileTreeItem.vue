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
  emits: ['select', 'toggle-dir'],
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
  color: #4a5568;
  text-decoration: none;
  transition: background-color 0.1s;
  user-select: none;
}

.tree-label:hover {
  background: #edf2f7;
}

.tree-file.active {
  background: #ebf4ff;
  color: #2b6cb0;
  font-weight: 500;
}

.tree-arrow {
  width: 14px;
  font-size: 9px;
  color: #a0aec0;
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
}

.tree-children {
  list-style: none;
  margin: 0;
  padding: 0 0 0 12px;
}
</style>
