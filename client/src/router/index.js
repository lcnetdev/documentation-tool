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
  routes
})

export default router
