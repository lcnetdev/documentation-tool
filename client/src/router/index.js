import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import ViewerLayout from '@/views/ViewerLayout.vue'
import EditorLayout from '@/views/EditorLayout.vue'
import { basePath } from '@/utils/basePath'
import { resolveIndexRedirect } from '@/utils/indexRedirect'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/view/:repoName',
    redirect: (to) => '/view/' + to.params.repoName + '/index.md'
  },
  {
    path: '/view/:repoName/:pathMatch(.*)',
    name: 'viewer',
    component: ViewerLayout
  },
  {
    path: '/edit/:repoName',
    redirect: (to) => '/edit/' + to.params.repoName + '/index.md'
  },
  {
    path: '/edit/:repoName/:pathMatch(.*)',
    name: 'editor',
    component: EditorLayout
  }
]

const router = createRouter({
  history: createWebHistory(basePath),
  routes,
  scrollBehavior(to) {
    if (to.hash) {
      const raw = to.hash.slice(1)
      return new Promise((resolve) => {
        setTimeout(() => {
          let el = document.getElementById(raw)
          if (!el) {
            try { el = document.getElementById(decodeURIComponent(raw)) } catch {}
          }
          if (el) {
            el.scrollIntoView({ behavior: 'smooth' })
          }
          resolve(false)
        }, 200)
      })
    }
    return { top: 0 }
  }
})

// When a URL points at a folder rather than a file, open the index.md inside it
router.beforeEach((to) => resolveIndexRedirect(to) || true)

export default router
