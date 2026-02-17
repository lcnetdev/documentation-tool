<template>
  <div class="live-preview">
    <div class="preview-content">
      <MarkdownRenderer
        :content="content"
        :repo-name="repoName"
        :current-file="currentFile"
        mode="edit"
      />
    </div>
  </div>
</template>

<script>
import MarkdownRenderer from '@/components/viewer/MarkdownRenderer.vue'

export default {
  name: 'LivePreview',
  components: {
    MarkdownRenderer
  },
  props: {
    content: {
      type: String,
      default: ''
    },
    repoName: {
      type: String,
      default: ''
    },
    currentFile: {
      type: String,
      default: ''
    }
  }
}
</script>

<style scoped>
.live-preview {
  flex: 1;
  overflow-y: auto;
}

.preview-content {
  padding: 24px;
  max-width: 800px;
}
</style>
