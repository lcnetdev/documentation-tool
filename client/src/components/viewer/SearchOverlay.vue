<template>
  <div v-if="visible" class="search-overlay" @click.self="$emit('close')">
    <div class="search-modal">
      <div class="search-header">
        <input
          ref="searchInput"
          v-model="query"
          type="text"
          placeholder="Search documentation..."
          class="search-input"
          @keydown.escape="$emit('close')"
        />
        <button class="search-close" @click="$emit('close')">Esc</button>
      </div>
      <div class="search-results">
        <div v-if="searching" class="search-status">Searching...</div>
        <div v-else-if="query && results.length === 0 && !searching" class="search-status">
          No results found
        </div>
        <div v-else-if="results.length > 0" class="results-list">
          <div class="match-count">{{ totalMatches }} match{{ totalMatches === 1 ? '' : 'es' }} in {{ results.length }} file{{ results.length === 1 ? '' : 's' }}</div>
          <div
            v-for="group in results"
            :key="group.file"
            class="result-group"
          >
            <div
              class="result-file"
              @click="$emit('navigate', group.file)"
            >
              {{ group.file }}
            </div>
            <div
              v-for="(match, idx) in group.matches"
              :key="idx"
              class="result-line"
              @click="$emit('navigate', group.file)"
            >
              <span class="line-number">{{ match.line }}</span>
              <span class="line-text" v-html="highlightMatch(match.text)"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { apiFetch } from '@/utils/api'

export default {
  name: 'SearchOverlay',
  props: {
    repoName: {
      type: String,
      required: true
    },
    visible: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'navigate'],
  data() {
    return {
      query: '',
      results: [],
      searching: false,
      debounceTimer: null
    }
  },
  computed: {
    totalMatches() {
      let count = 0
      for (const group of this.results) {
        count += group.matches ? group.matches.length : 0
      }
      return count
    }
  },
  watch: {
    query(newVal) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
      }
      if (!newVal || newVal.trim().length === 0) {
        this.results = []
        return
      }
      this.debounceTimer = setTimeout(() => {
        this.performSearch()
      }, 300)
    },
    visible(newVal) {
      if (newVal) {
        this.$nextTick(() => {
          if (this.$refs.searchInput) {
            this.$refs.searchInput.focus()
          }
        })
      } else {
        this.query = ''
        this.results = []
      }
    }
  },
  methods: {
    async performSearch() {
      if (!this.query || this.query.trim().length === 0) return
      this.searching = true
      try {
        const response = await apiFetch(
          '/api/repos/' + this.repoName + '/search?q=' + encodeURIComponent(this.query.trim())
        )
        if (!response.ok) {
          throw new Error('Search failed')
        }
        const data = await response.json()
        this.results = data.results || []
      } catch (err) {
        this.results = []
      } finally {
        this.searching = false
      }
    },
    highlightMatch(text) {
      if (!this.query) return this.escapeHtml(text)
      const escaped = this.escapeHtml(text)
      const queryEscaped = this.escapeHtml(this.query)
      const regex = new RegExp('(' + this.escapeRegex(queryEscaped) + ')', 'gi')
      return escaped.replace(regex, '<mark>$1</mark>')
    },
    escapeHtml(str) {
      const div = document.createElement('div')
      div.appendChild(document.createTextNode(str))
      return div.innerHTML
    },
    escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
  }
}
</script>

<style scoped>
.search-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
  z-index: 1000;
}

.search-modal {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 640px;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-header {
  display: flex;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.search-input {
  flex: 1;
  border: none;
  font-size: 16px;
  outline: none;
  padding: 4px 0;
  color: #1a202c;
}

.search-input::placeholder {
  color: #a0aec0;
}

.search-close {
  padding: 4px 8px;
  font-size: 11px;
  background: #edf2f7;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  cursor: pointer;
  color: #718096;
  margin-left: 12px;
}

.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.search-status {
  padding: 24px 16px;
  text-align: center;
  color: #718096;
  font-size: 14px;
}

.match-count {
  padding: 4px 16px 8px;
  font-size: 12px;
  color: #a0aec0;
}

.result-group {
  margin-bottom: 4px;
}

.result-file {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #2b6cb0;
  cursor: pointer;
  font-family: 'SF Mono', SFMono-Regular, Menlo, monospace;
}

.result-file:hover {
  background: #ebf8ff;
}

.result-line {
  padding: 4px 16px 4px 32px;
  font-size: 13px;
  color: #4a5568;
  cursor: pointer;
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.result-line:hover {
  background: #f7fafc;
}

.line-number {
  color: #a0aec0;
  font-size: 11px;
  font-family: 'SF Mono', SFMono-Regular, Menlo, monospace;
  flex-shrink: 0;
  min-width: 32px;
  text-align: right;
}

.line-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'SF Mono', SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.line-text :deep(mark) {
  background: #fefcbf;
  color: #744210;
  padding: 1px 2px;
  border-radius: 2px;
}
</style>
