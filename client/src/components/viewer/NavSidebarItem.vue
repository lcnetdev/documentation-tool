<template>
  <li class="tree-item">
    <div
      v-if="item.type === 'directory'"
      class="tree-label tree-dir"
      :class="{ expanded: isExpanded }"
      @click="onDirClick"
    >
      <span class="tree-arrow">{{ isExpanded ? '&#9662;' : '&#9656;' }}</span>
      <span class="tree-icon folder-icon"></span>
      <span class="tree-name">{{ item.title || item.name }}</span>
    </div>
    <router-link
      v-else
      :to="'/view/' + repoName + '/' + item.path"
      class="tree-label tree-file"
      :class="{ active: item.path === currentFile }"
    >
      <span class="tree-icon file-icon"></span>
      <span class="tree-name">{{ item.title || item.name }}</span>
    </router-link>
    <ul v-if="item.type === 'directory' && isExpanded && item.children" class="tree-children">
      <NavSidebarItem
        v-for="child in item.children"
        :key="child.path"
        :item="child"
        :repo-name="repoName"
        :current-file="currentFile"
        :expanded-dirs="expandedDirs"
        @toggle-dir="$emit('toggle-dir', $event)"
        @navigate="$emit('navigate', $event)"
      />
    </ul>
  </li>
</template>

<script>
export default {
  name: 'NavSidebarItem',
  props: {
    item: {
      type: Object,
      required: true
    },
    repoName: {
      type: String,
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
  emits: ['toggle-dir', 'navigate'],
  computed: {
    isExpanded() {
      return !!this.expandedDirs[this.item.path]
    }
  },
  methods: {
    onDirClick() {
      this.$emit('toggle-dir', this.item.path)
      if (this.item.indexFile) {
        this.$emit('navigate', this.item.indexFile)
      }
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
  padding: 4px 12px 4px 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-tertiary);
  text-decoration: none;
  border-radius: 0;
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
  width: 16px;
  font-size: 10px;
  color: var(--text-faint);
  flex-shrink: 0;
}

.tree-icon {
  width: 16px;
  height: 16px;
  margin-right: 6px;
  flex-shrink: 0;
}

.folder-icon::before {
  content: '\1F4C1';
  font-size: 13px;
}

.file-icon::before {
  content: '\1F4C4';
  font-size: 13px;
}

.tree-file .tree-icon {
  margin-left: 16px;
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
