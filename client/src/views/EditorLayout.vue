<template>
  <div v-if="!authenticated" class="login-overlay">
    <div class="login-card">
      <h2>Sign in to Edit</h2>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="username">Username</label>
          <input
            id="username"
            v-model="loginUsername"
            type="text"
            placeholder="Username"
            required
          />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="loginPassword"
            type="password"
            placeholder="Password"
            required
          />
        </div>
        <div v-if="loginError" class="login-error">{{ loginError }}</div>
        <button type="submit" class="login-btn">Sign In</button>
      </form>
    </div>
  </div>
  <div v-else class="editor-layout">
    <aside v-show="!sidebarCollapsed" class="editor-filetree">
      <div class="filetree-header">
        <div class="filetree-title-row">
          <h3>{{ displayName }}</h3>
          <div v-if="isBranch" class="branch-badge" :title="'Branch of ' + parentRepo">
            &#x2937; {{ branchDisplayName }}
          </div>
        </div>
        <div class="filetree-actions">
          <button v-if="isOriginal" class="branch-btn" @click="showBranchModal = true" title="Create a branch">Branch</button>
          <button v-if="isBranch" class="merge-btn" @click="showMergeModal = true" title="Merge branch into original">Merge</button>
          <button class="theme-toggle" @click="onToggleTheme" :title="currentTheme === 'dark' ? 'Day Mode' : 'Night Mode'">
            {{ currentTheme === 'dark' ? '&#x2600;' : '&#x263E;' }}
          </button>
          <button class="logout-btn" @click="handleLogout">Logout</button>
          <button class="collapse-btn" @click="sidebarCollapsed = true" title="Collapse file tree">
            &#x2039;
          </button>
        </div>
      </div>
      <div class="filetree-toolbar">
        <button v-if="!reorderMode" class="filetree-toolbar-btn filetree-toolbar-new" @click="showCreateModal = true" title="Create new file or directory">New</button>
        <button
          class="filetree-toolbar-btn"
          :class="{ 'filetree-toolbar-active': reorderMode }"
          @click="onReorder"
          :title="reorderMode ? 'Save order and exit' : 'Reorder files'"
        >{{ reorderMode ? 'Done' : 'Reorder' }}</button>
        <button v-if="!reorderMode" class="filetree-toolbar-btn" @click="onMove" title="Move file or directory">Move</button>
      </div>
      <div v-if="reorderMode" class="reorder-list">
        <div v-if="reorderSaving" class="reorder-saving">
          <span class="saving-spinner"></span> Saving order...
        </div>
        <ul v-else class="reorder-items">
          <li
            v-for="(item, index) in reorderItems"
            :key="item.name"
            class="reorder-item"
            draggable="true"
            @dragstart="onReorderDragStart(index, $event)"
            @dragover.prevent="onReorderDragOver(index, $event)"
            @dragleave="onReorderDragLeave($event)"
            @drop="onReorderDrop(index, $event)"
            @dragend="onReorderDragEnd"
          >
            <span class="reorder-grip">&#x2630;</span>
            <span class="reorder-icon">{{ item.type === 'directory' ? '&#x1F4C1;' : '&#x1F4C4;' }}</span>
            <span class="reorder-name">{{ item.title }}</span>
          </li>
        </ul>
      </div>
      <FileTree
        v-show="!reorderMode"
        ref="fileTree"
        :repo-name="repoName"
        :current-file="currentFile"
        @select="onFileSelect"
        @delete-dir="onDeleteDir"
        @rename-dir="onRenameDir"
      />
    </aside>
    <div class="editor-main">
      <button v-if="sidebarCollapsed" class="expand-btn-editor" @click="sidebarCollapsed = false" title="Show file tree">
        &#x203A;
      </button>
      <div class="editor-pane">
        <EditorToolbar @action="onToolbarAction" @delete="onDeleteFile" />
        <ImageDropZone
          :repo-name="repoName"
          :current-file="currentFile"
          @image-uploaded="onImageUploaded"
        >
          <MarkdownEditor
            ref="markdownEditor"
            v-model="fileContent"
            @image-paste="onImagePaste"
          />
        </ImageDropZone>
      </div>
      <div class="preview-pane">
        <div class="preview-header">Preview</div>
        <LivePreview
          :content="fileContent"
          :repo-name="repoName"
          :current-file="currentFile"
        />
      </div>
    </div>
    <SaveBar
      :has-changes="hasUnsavedChanges"
      :saving="saving"
      @save="onSave"
    />
    <CreateModal
      :visible="showCreateModal"
      :repo-name="repoName"
      @close="showCreateModal = false"
      @created="onCreated"
    />
    <BranchModal
      :visible="showBranchModal"
      :repo-name="repoName"
      @close="showBranchModal = false"
      @created="onBranchCreated"
    />
    <MergeModal
      :visible="showMergeModal"
      :repo-name="repoName"
      :parent-repo="parentRepo"
      :branch-name="branchDisplayName"
      @close="showMergeModal = false"
      @merged="onMerged"
    />
    <MoveModal
      :visible="showMoveModal"
      :repo-name="repoName"
      @close="showMoveModal = false"
      @moved="onMoved"
    />
  </div>
</template>

<script>
import FileTree from '@/components/editor/FileTree.vue'
import MarkdownEditor from '@/components/editor/MarkdownEditor.vue'
import EditorToolbar from '@/components/editor/EditorToolbar.vue'
import LivePreview from '@/components/editor/LivePreview.vue'
import SaveBar from '@/components/editor/SaveBar.vue'
import ImageDropZone from '@/components/editor/ImageDropZone.vue'
import CreateModal from '@/components/editor/CreateModal.vue'
import BranchModal from '@/components/editor/BranchModal.vue'
import MergeModal from '@/components/editor/MergeModal.vue'
import MoveModal from '@/components/editor/MoveModal.vue'
import { state as authState, isAuthenticated, login, logout, getAuthHeader } from '@/stores/auth'
import { computeRelativePath } from '@/utils/relativePath'
import { apiFetch } from '@/utils/api'
import { getTheme, toggleTheme } from '@/utils/theme'

export default {
  name: 'EditorLayout',
  components: {
    FileTree,
    MarkdownEditor,
    EditorToolbar,
    LivePreview,
    SaveBar,
    ImageDropZone,
    CreateModal,
    BranchModal,
    MergeModal,
    MoveModal
  },
  data() {
    return {
      fileContent: '',
      originalContent: '',
      saving: false,
      loading: false,
      error: null,
      loginUsername: '',
      loginPassword: '',
      loginError: '',
      sidebarCollapsed: false,
      showCreateModal: false,
      showBranchModal: false,
      showMergeModal: false,
      showMoveModal: false,
      repoInfo: null,
      currentTheme: getTheme(),
      reorderMode: false,
      reorderItems: [],
      reorderSaving: false,
      reorderDragIndex: null
    }
  },
  computed: {
    repoName() {
      return this.$route.params.repoName
    },
    displayName() {
      return this.formatRepoName(this.repoName)
    },
    currentFile() {
      const pathMatch = this.$route.params.pathMatch
      if (Array.isArray(pathMatch)) {
        return pathMatch.join('/')
      }
      return pathMatch || ''
    },
    hasUnsavedChanges() {
      return this.fileContent !== this.originalContent
    },
    authenticated() {
      return isAuthenticated.value
    },
    isBranch() {
      return this.repoInfo && this.repoInfo.type === 'branch'
    },
    isOriginal() {
      return !this.repoInfo || this.repoInfo.type === 'original'
    },
    parentRepo() {
      return this.repoInfo ? this.repoInfo.parentRepo || '' : ''
    },
    branchDisplayName() {
      return this.repoInfo ? this.repoInfo.branchName || '' : ''
    }
  },
  watch: {
    '$route.params': {
      handler() {
        this.loadFile()
      },
      deep: true
    },
    repoName: {
      handler() {
        this.fetchRepoInfo()
      },
      immediate: true
    }
  },
  mounted() {
    if (this.authenticated) {
      this.loadFile()
    }
    this._onKeydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (this.hasUnsavedChanges && !this.saving) {
          this.onSave()
        }
      }
    }
    window.addEventListener('keydown', this._onKeydown)
  },
  beforeUnmount() {
    if (this._onKeydown) {
      window.removeEventListener('keydown', this._onKeydown)
    }
  },
  methods: {
    formatRepoName(name) {
      return (name || '')
        .replace(/\bdocumentation[-_]?/gi, '')
        .replace(/[-_]+/g, ' ')
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase())
    },
    onToggleTheme() {
      this.currentTheme = toggleTheme()
    },
    async handleLogin() {
      this.loginError = ''
      if (!this.loginUsername || !this.loginPassword) {
        this.loginError = 'Username and password are required'
        return
      }
      const encoded = btoa(this.loginUsername + ':' + this.loginPassword)
      try {
        const response = await apiFetch(
          '/api/repos/' + this.repoName + '/git/status',
          { headers: { 'Authorization': 'Basic ' + encoded } }
        )
        if (response.status === 401) {
          this.loginError = 'Invalid password'
          return
        }
      } catch {
        // Network error — allow login attempt
      }
      login(this.loginUsername, this.loginPassword)
      this.loginUsername = ''
      this.loginPassword = ''
      this.loadFile()
    },
    handleLogout() {
      logout()
      const viewPath = '/view/' + this.repoName + '/' + (this.currentFile || '')
      this.$router.push(viewPath)
    },
    async fetchRepoInfo() {
      if (!this.repoName) return
      try {
        const response = await apiFetch('/api/repos/' + this.repoName + '/info')
        if (response.ok) {
          this.repoInfo = await response.json()
        }
      } catch {
        // ignore
      }
    },
    onBranchCreated(result) {
      this.$router.push('/edit/' + result.newRepo + '/index.md')
    },
    onMerged(result) {
      this.$router.push('/edit/' + result.parentRepo + '/index.md')
    },
    async loadFile() {
      if (!this.repoName || !this.currentFile) return
      this.loading = true
      this.error = null
      try {
        const response = await apiFetch(
          '/api/repos/' + this.repoName + '/file/' + this.currentFile + '?raw'
        )
        if (!response.ok) {
          throw new Error('Failed to load file: ' + response.statusText)
        }
        const data = await response.json()
        this.fileContent = data.content
        this.originalContent = data.content
      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },
    onCreated(item) {
      if (this.$refs.fileTree) {
        this.$refs.fileTree.fetchTree()
      }
      if (item.type === 'file') {
        this.$router.push('/edit/' + this.repoName + '/' + item.path)
      }
    },
    onFileSelect(filePath) {
      if (this.hasUnsavedChanges) {
        const confirmed = window.confirm(
          'You have unsaved changes. Discard and navigate?'
        )
        if (!confirmed) return
      }
      this.$router.push('/edit/' + this.repoName + '/' + filePath)
    },
    onToolbarAction(type, payload) {
      if (this.$refs.markdownEditor) {
        this.$refs.markdownEditor.insertAtCursor(payload)
      }
    },
    onImageUploaded(relativePath) {
      const markdownImage = '![image](' + relativePath + ')'
      if (this.$refs.markdownEditor) {
        this.$refs.markdownEditor.insertAtCursor(markdownImage)
      }
    },
    async onImageDrop(file) {
      await this.uploadImage(file)
    },
    async onImagePaste(file) {
      await this.uploadImage(file)
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
        const imagePath = data.path || data.relativePath
        if (imagePath) {
          const relPath = computeRelativePath(this.currentFile, imagePath)
          const markdownImage = '![image](' + relPath + ')'
          if (this.$refs.markdownEditor) {
            this.$refs.markdownEditor.insertAtCursor(markdownImage)
          }
        }
      } catch (err) {
        alert('Image upload failed: ' + err.message)
      }
    },
    async onSave(commitMessage) {
      this.saving = true
      try {
        const response = await apiFetch(
          '/api/repos/' + this.repoName + '/file/' + this.currentFile,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': getAuthHeader()
            },
            body: JSON.stringify({
              content: this.fileContent,
              commitMessage: commitMessage || 'Update ' + this.currentFile
            })
          }
        )
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.details || errData.error || 'Failed to save file')
        }
        this.originalContent = this.fileContent
        if (this.$refs.fileTree) {
          this.$refs.fileTree.fetchTree()
        }
      } catch (err) {
        alert('Save failed: ' + err.message)
      } finally {
        this.saving = false
      }
    },
    async onDeleteFile() {
      if (!this.currentFile) return
      const confirmed = window.confirm(
        'Delete "' + this.currentFile + '"? This will remove the file and commit the change.'
      )
      if (!confirmed) return
      try {
        const response = await apiFetch(
          '/api/repos/' + this.repoName + '/file/' + this.currentFile,
          {
            method: 'DELETE',
            headers: {
              'Authorization': getAuthHeader()
            }
          }
        )
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.details || errData.error || 'Failed to delete file')
        }
        if (this.$refs.fileTree) {
          this.$refs.fileTree.fetchTree()
        }
        this.$router.push('/edit/' + this.repoName + '/index.md')
      } catch (err) {
        alert('Delete failed: ' + err.message)
      }
    },
    async onReorder() {
      if (this.reorderMode) {
        // "Done" pressed — save the new order
        this.reorderSaving = true
        try {
          const order = this.reorderItems.map(item => item.name)
          const response = await apiFetch(
            '/api/repos/' + this.repoName + '/nav-order',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': getAuthHeader()
              },
              body: JSON.stringify({ order })
            }
          )
          if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.details || errData.error || 'Failed to save order')
          }
          this.reorderMode = false
          this.reorderItems = []
          // Refresh tree to show new order
          if (this.$refs.fileTree) {
            this.$refs.fileTree.fetchTree()
          }
          // Reload current file in case it was index.md (content changed)
          if (this.currentFile === 'index.md') {
            this.loadFile()
          }
        } catch (err) {
          alert('Failed to save order: ' + err.message)
        } finally {
          this.reorderSaving = false
        }
      } else {
        // Enter reorder mode — get root items from tree
        if (!this.$refs.fileTree || !this.$refs.fileTree.tree.length) {
          return
        }
        this.reorderItems = this.$refs.fileTree.tree.map(item => ({
          name: item.name,
          title: item.title || item.name,
          type: item.type
        }))
        this.reorderMode = true
      }
    },
    onReorderDragStart(index, e) {
      this.reorderDragIndex = index
      e.dataTransfer.effectAllowed = 'move'
      e.target.classList.add('dragging')
    },
    onReorderDragOver(index, e) {
      e.dataTransfer.dropEffect = 'move'
      const target = e.currentTarget
      if (index !== this.reorderDragIndex) {
        const rect = target.getBoundingClientRect()
        const mid = rect.top + rect.height / 2
        target.classList.remove('drag-above', 'drag-below')
        target.classList.add(e.clientY < mid ? 'drag-above' : 'drag-below')
      }
    },
    onReorderDragLeave(e) {
      e.currentTarget.classList.remove('drag-above', 'drag-below')
    },
    onReorderDrop(index, e) {
      e.currentTarget.classList.remove('drag-above', 'drag-below')
      if (this.reorderDragIndex === null || this.reorderDragIndex === index) return
      const rect = e.currentTarget.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      const insertBefore = e.clientY < mid

      const item = this.reorderItems.splice(this.reorderDragIndex, 1)[0]
      let targetIndex = index
      if (this.reorderDragIndex < index) targetIndex--
      if (!insertBefore) targetIndex++
      this.reorderItems.splice(targetIndex, 0, item)
      this.reorderDragIndex = null
    },
    onReorderDragEnd() {
      this.reorderDragIndex = null
      document.querySelectorAll('.reorder-item').forEach(el => {
        el.classList.remove('dragging', 'drag-above', 'drag-below')
      })
    },
    onMove() {
      this.showMoveModal = true
    },
    onMoved(result) {
      if (this.$refs.fileTree) {
        this.$refs.fileTree.fetchTree()
      }
      // If the moved file was the currently open file, navigate to its new path
      if (result.newPath) {
        this.$router.push('/edit/' + this.repoName + '/' + result.newPath)
      }
    },
    async onDeleteDir(dirPath) {
      if (!dirPath) return
      const confirmed = window.confirm(
        'Delete directory "' + dirPath + '" and all its contents? This will commit the change.'
      )
      if (!confirmed) return
      try {
        const response = await apiFetch(
          '/api/repos/' + this.repoName + '/directory/' + dirPath,
          {
            method: 'DELETE',
            headers: {
              'Authorization': getAuthHeader()
            }
          }
        )
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.details || errData.error || 'Failed to delete directory')
        }
        if (this.$refs.fileTree) {
          this.$refs.fileTree.fetchTree()
        }
        // If currently editing a file inside the deleted directory, navigate away
        if (this.currentFile && this.currentFile.startsWith(dirPath + '/')) {
          this.$router.push('/edit/' + this.repoName + '/index.md')
        }
      } catch (err) {
        alert('Delete failed: ' + err.message)
      }
    },
    async onRenameDir(dirPath) {
      if (!dirPath) return
      const currentName = dirPath.split('/').pop()
      const newName = window.prompt('Rename directory "' + currentName + '" to:', currentName)
      if (!newName || newName.trim() === currentName) return

      try {
        const response = await apiFetch(
          '/api/repos/' + this.repoName + '/rename-dir',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': getAuthHeader()
            },
            body: JSON.stringify({
              dirPath: dirPath,
              newName: newName.trim()
            })
          }
        )
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.details || errData.error || 'Failed to rename directory')
        }
        const result = await response.json()
        if (this.$refs.fileTree) {
          this.$refs.fileTree.fetchTree()
        }
        // If currently editing a file inside the renamed directory, update the route
        if (this.currentFile && this.currentFile.startsWith(dirPath + '/')) {
          const newFilePath = this.currentFile.replace(dirPath, result.newPath)
          this.$router.push('/edit/' + this.repoName + '/' + newFilePath)
        }
      } catch (err) {
        alert('Rename failed: ' + err.message)
      }
    }
  }
}
</script>

<style scoped>
.login-overlay { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: var(--bg-login); }
.login-card { background: var(--bg-surface); padding: 40px; border-radius: 8px; box-shadow: var(--shadow-md); width: 100%; max-width: 400px; }
.login-card h2 { margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary); text-align: center; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 4px; font-size: 13px; font-weight: 500; color: var(--text-tertiary); }
.form-group input { width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 14px; box-sizing: border-box; background: var(--bg-surface); color: var(--text-primary); }
.form-group input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(74, 144, 217, 0.1); }
.login-error { color: var(--color-error); font-size: 13px; margin-bottom: 12px; }
.login-btn { width: 100%; padding: 10px; background: var(--color-primary); color: #fff; border: none; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer; }
.login-btn:hover { background: var(--color-primary-hover); }
.editor-layout { display: flex; height: 100vh; overflow: hidden; }
.editor-filetree { width: 250px; min-width: 250px; background: var(--bg-surface); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.editor-filetree :deep(.file-tree) { flex: 1 1 0; min-height: 0; overflow-y: auto; padding-bottom: 48px; }
.filetree-header { padding: 12px 16px; border-bottom: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }
.filetree-title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.filetree-header h3 { margin: 0; font-size: 13px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.branch-badge { font-size: 10px; padding: 2px 6px; background: var(--color-badge-bg); color: var(--color-badge-text); border-radius: 3px; white-space: nowrap; flex-shrink: 0; }
.filetree-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.collapse-btn { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: var(--bg-surface-hover); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; color: var(--text-tertiary); font-size: 16px; font-weight: bold; line-height: 1; flex-shrink: 0; }
.collapse-btn:hover { background: var(--bg-surface-active); }
.expand-btn-editor { display: flex; align-items: center; justify-content: center; width: 24px; background: var(--bg-surface-alt); border: none; border-right: 1px solid var(--border-color); cursor: pointer; color: var(--text-tertiary); font-size: 16px; font-weight: bold; flex-shrink: 0; }
.expand-btn-editor:hover { background: var(--bg-surface-hover); }
.filetree-toolbar { display: flex; gap: 0; border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
.filetree-toolbar-btn { flex: 1; padding: 6px 0; font-size: 11px; font-weight: 500; background: var(--bg-surface-hover); border: none; border-right: 1px solid var(--border-color); cursor: pointer; color: var(--text-tertiary); text-align: center; }
.filetree-toolbar-btn:last-child { border-right: none; }
.filetree-toolbar-btn:hover { background: var(--bg-surface-active); color: var(--text-primary); }
.filetree-toolbar-new { color: var(--color-primary); font-weight: 600; }
.filetree-toolbar-active { background: var(--color-primary) !important; color: #fff !important; font-weight: 600; }
.reorder-list { flex: 1; overflow-y: auto; padding: 4px 0; }
.reorder-saving { padding: 16px; font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 8px; }
.reorder-items { list-style: none; margin: 0; padding: 0; }
.reorder-item { display: flex; align-items: center; padding: 6px 12px; cursor: grab; font-size: 12px; color: var(--text-tertiary); border-bottom: 1px solid transparent; transition: background-color 0.1s; user-select: none; }
.reorder-item:hover { background: var(--bg-surface-hover); }
.reorder-item.dragging { opacity: 0.4; }
.reorder-item.drag-above { border-top: 2px solid var(--color-primary); }
.reorder-item.drag-below { border-bottom: 2px solid var(--color-primary); }
.reorder-grip { margin-right: 8px; color: var(--text-faint); font-size: 10px; cursor: grab; }
.reorder-icon { font-size: 11px; margin-right: 5px; flex-shrink: 0; }
.reorder-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.branch-btn { padding: 2px 8px; font-size: 11px; background: var(--bg-surface-hover); border: 1px solid var(--border-color); border-radius: 3px; cursor: pointer; color: var(--text-tertiary); font-weight: 500; }
.branch-btn:hover { background: var(--bg-surface-active); }
.merge-btn { padding: 2px 8px; font-size: 11px; background: var(--color-badge-bg); border: 1px solid var(--color-badge-border); border-radius: 3px; cursor: pointer; color: var(--color-badge-text); font-weight: 500; }
.merge-btn:hover { background: var(--color-badge-hover); }
.logout-btn { padding: 2px 8px; font-size: 11px; background: transparent; border: 1px solid var(--border-color); border-radius: 3px; cursor: pointer; color: var(--text-muted); }
.logout-btn:hover { background: var(--color-error-bg); border-color: var(--color-error); color: var(--color-error); }
.editor-main { flex: 1; display: flex; min-width: 0; height: calc(100vh - 52px); overflow: hidden; }
.editor-pane { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; border-right: 1px solid var(--border-color); overflow: hidden; }
.preview-pane { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow-y: auto; }
.preview-header { padding: 8px 16px; font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border-color); background: var(--bg-surface-alt); }
</style>
