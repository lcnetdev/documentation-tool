import { createRouter, createWebHistory } from 'vue-router'
import ViewerLayout from '@/views/ViewerLayout.vue'
import EditorLayout from '@/views/EditorLayout.vue'
import { basePath } from '@/utils/basePath'

const routes = [
  {
    path: '/',
    redirect: '/view/documentation-marva-manual/index.md'
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
  routes
})

export default router
