<template>
  <div class="home-page">
    <header class="home-header">
      <div class="home-header-top">
        <h1>Documentation</h1>
        <button class="theme-toggle" @click="onToggleTheme" :title="currentTheme === 'dark' ? 'Switch to Day Mode' : 'Switch to Night Mode'">
          {{ currentTheme === 'dark' ? '&#x2600;' : '&#x263E;' }}
        </button>
      </div>
      <p class="home-subtitle">Select a repository to view</p>
    </header>
    <div v-if="loading" class="home-loading">Loading repositories...</div>
    <div v-else-if="error" class="home-error">{{ error }}</div>
    <div v-else class="repo-grid">
      <div
        v-for="repo in originalRepos"
        :key="repo.name"
        class="repo-card"
        @click="openRepo(repo.name)"
      >
        <h2 class="repo-card-title">{{ formatName(repo.name) }}</h2>
        <p class="repo-card-name">{{ repo.name }}</p>
        <div v-if="repo.branches && repo.branches.length" class="repo-branches">
          <div class="branches-label">
            {{ repo.branches.length }} branch{{ repo.branches.length > 1 ? 'es' : '' }}
          </div>
          <div
            v-for="branch in repo.branches"
            :key="branch.name"
            class="branch-item"
            @click.stop="openRepo(branch.name)"
          >
            <span class="branch-icon">&#x2937;</span>
            <span class="branch-name">{{ branch.branchName }}</span>
            <span v-if="branch.createdBy" class="branch-author">by {{ branch.createdBy }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { apiFetch } from '@/utils/api'
import { getTheme, toggleTheme } from '@/utils/theme'

export default {
  name: 'HomeView',
  data() {
    return {
      repos: [],
      loading: false,
      error: null,
      currentTheme: getTheme()
    }
  },
  computed: {
    originalRepos() {
      return this.repos.filter(r => r.type === 'original')
    }
  },
  mounted() {
    this.fetchRepos()
  },
  methods: {
    onToggleTheme() {
      this.currentTheme = toggleTheme()
    },
    async fetchRepos() {
      this.loading = true
      this.error = null
      try {
        const response = await apiFetch('/api/repos')
        if (!response.ok) {
          throw new Error('Failed to load repositories')
        }
        this.repos = await response.json()
      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },
    openRepo(name) {
      this.$router.push('/view/' + name + '/index.md')
    },
    formatName(name) {
      return (name || '')
        .replace(/\bdocumentation[-_]?/gi, '')
        .replace(/[-_]+/g, ' ')
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase())
    }
  }
}
</script>

<style scoped>
.home-page { min-height: 100vh; background: var(--bg-body); padding: 60px 24px; }
.home-header { text-align: center; margin-bottom: 48px; }
.home-header-top { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 8px; }
.home-header h1 { font-size: 28px; font-weight: 700; color: var(--text-primary); margin: 0; }
.home-subtitle { font-size: 15px; color: var(--text-muted); margin: 0; }
.home-loading, .home-error { text-align: center; padding: 48px; font-size: 15px; color: var(--text-muted); }
.home-error { color: var(--color-error); }
.repo-grid { max-width: 800px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }
.repo-card { background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 24px; cursor: pointer; transition: box-shadow 0.15s, border-color 0.15s; }
.repo-card:hover { border-color: var(--color-primary); box-shadow: 0 4px 12px rgba(74, 144, 217, 0.15); }
.repo-card-title { font-size: 18px; font-weight: 600; color: var(--text-primary); margin: 0 0 4px 0; }
.repo-card-name { font-size: 12px; color: var(--text-faint); margin: 0 0 12px 0; font-family: 'SF Mono', SFMono-Regular, Menlo, monospace; }
.repo-branches { border-top: 1px solid var(--border-light); padding-top: 12px; margin-top: 4px; }
.branches-label { font-size: 11px; font-weight: 600; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
.branch-item { display: flex; align-items: center; gap: 6px; padding: 6px 8px; margin: 0 -8px; border-radius: 4px; cursor: pointer; font-size: 13px; }
.branch-item:hover { background: var(--bg-surface-hover); }
.branch-icon { color: var(--text-faint); font-size: 14px; }
.branch-name { color: var(--color-primary); font-weight: 500; }
.branch-author { color: var(--text-faint); font-size: 11px; }
</style>
