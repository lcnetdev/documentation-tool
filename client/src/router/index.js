import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import ViewerLayout from '@/views/ViewerLayout.vue'
import EditorLayout from '@/views/EditorLayout.vue'
import { basePath } from '@/utils/basePath'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/view/:repoName/:pathMatch(.*)',
    name: 'viewer',
    component: ViewerLayout
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

export default router
