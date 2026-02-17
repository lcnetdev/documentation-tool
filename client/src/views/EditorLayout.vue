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
        <h3>{{ repoName }}</h3>
        <div class="filetree-actions">
          <button class="new-btn" @click="showCreateModal = true" title="Create new file or directory">+ New</button>
          <button class="logout-btn" @click="handleLogout">Logout</button>
          <button class="collapse-btn" @click="sidebarCollapsed = true" title="Collapse file tree">
            &#x2039;
          </button>
        </div>
      </div>
      <FileTree
        ref="fileTree"
        :repo-name="repoName"
        :current-file="currentFile"
        @select="onFileSelect"
      />
    </aside>
    <div class="editor-main">
      <button v-if="sidebarCollapsed" class="expand-btn-editor" @click="sidebarCollapsed = false" title="Show file tree">
        &#x203A;
      </button>
      <div class="editor-pane">
        <EditorToolbar @action="onToolbarAction" />
        <ImageDropZone
          :repo-name="repoName"
          :current-file="currentFile"
          @image-uploaded="onImageUploaded"
        >
          <MarkdownEditor
            ref="markdownEditor"
            v-model="fileContent"
            @image-drop="onImageDrop"
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
import { state as authState, isAuthenticated, login, logout, getAuthHeader } from '@/stores/auth'
import { computeRelativePath } from '@/utils/relativePath'
import { apiFetch } from '@/utils/api'

export default {
  name: 'EditorLayout',
  components: {
    FileTree,
    MarkdownEditor,
    EditorToolbar,
    LivePreview,
    SaveBar,
    ImageDropZone,
    CreateModal
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
      showCreateModal: false
    }
  },
  computed: {
    repoName() {
      return this.$route.params.repoName
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
    }
  },
  watch: {
    '$route.params': {
      handler() {
        this.loadFile()
      },
      deep: true
    }
  },
  mounted() {
    if (this.authenticated) {
      this.loadFile()
    }
  },
  methods: {
    async handleLogin() {
      this.loginError = ''
      if (!this.loginUsername || !this.loginPassword) {
        this.loginError = 'Username and password are required'
        return
      }
      // Validate credentials against the server before storing
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
        // Network error — allow login attempt, will fail on actual operations
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
    async loadFile() {
      if (!this.repoName || !this.currentFile) return
      this.loading = true
      this.error = null
      try {
        const response = await apiFetch(
          '/api/repos/' + this.repoName + '/file/' + this.currentFile
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
          throw new Error(errData.message || 'Failed to save file')
        }
        this.originalContent = this.fileContent
      } catch (err) {
        alert('Save failed: ' + err.message)
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<style scoped>
.login-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f0f2f5;
}

.login-card {
  background: #fff;
  padding: 40px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

.login-card h2 {
  margin: 0 0 24px 0;
  font-size: 20px;
  color: #1a202c;
  text-align: center;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: 500;
  color: #4a5568;
}

.form-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #4a90d9;
  box-shadow: 0 0 0 3px rgba(74, 144, 217, 0.1);
}

.login-error {
  color: #e53e3e;
  font-size: 13px;
  margin-bottom: 12px;
}

.login-btn {
  width: 100%;
  padding: 10px;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.login-btn:hover {
  background: #357abd;
}

.editor-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.editor-filetree {
  width: 250px;
  min-width: 250px;
  background: #fff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.filetree-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.filetree-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #1a202c;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filetree-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.collapse-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: #edf2f7;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  cursor: pointer;
  color: #4a5568;
  font-size: 16px;
  font-weight: bold;
  line-height: 1;
  flex-shrink: 0;
}

.collapse-btn:hover {
  background: #e2e8f0;
}

.expand-btn-editor {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  background: #f7fafc;
  border: none;
  border-right: 1px solid #e2e8f0;
  cursor: pointer;
  color: #4a5568;
  font-size: 16px;
  font-weight: bold;
  flex-shrink: 0;
}

.expand-btn-editor:hover {
  background: #edf2f7;
}

.new-btn {
  padding: 2px 8px;
  font-size: 11px;
  background: #4a90d9;
  border: 1px solid #357abd;
  border-radius: 3px;
  cursor: pointer;
  color: #fff;
  font-weight: 500;
}

.new-btn:hover {
  background: #357abd;
}

.logout-btn {
  padding: 2px 8px;
  font-size: 11px;
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 3px;
  cursor: pointer;
  color: #718096;
}

.logout-btn:hover {
  background: #fee;
  border-color: #e53e3e;
  color: #e53e3e;
}

.editor-main {
  flex: 1;
  display: flex;
  min-width: 0;
  height: calc(100vh - 52px);
  overflow: hidden;
}

.editor-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid #e2e8f0;
  overflow: hidden;
}

.preview-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}

.preview-header {
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  color: #718096;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #e2e8f0;
  background: #f7fafc;
}
</style>
