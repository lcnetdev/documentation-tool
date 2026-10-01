import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'

vi.mock('@/utils/api', () => ({
  apiFetch: vi.fn(() => Promise.resolve({ ok: false, status: 500, statusText: 'nope', json: () => Promise.resolve({}) }))
}))
// theme.js touches localStorage at import time, which Node's own global shadows under jsdom
vi.mock('@/utils/theme', () => ({ getTheme: () => 'light', toggleTheme: () => 'dark' }))

import ViewerLayout from '@/views/ViewerLayout.vue'

/** Stands in for window.matchMedia; `resize(true)` moves below the breakpoint. */
function fakeViewport(mobile) {
  const listeners = new Set()
  const query = {
    matches: mobile,
    media: '(max-width: 900px)',
    addEventListener: (_type, fn) => listeners.add(fn),
    removeEventListener: (_type, fn) => listeners.delete(fn)
  }
  window.matchMedia = vi.fn(() => query)
  return {
    listeners,
    resize(next) {
      query.matches = next
      listeners.forEach(fn => fn({ matches: next }))
    }
  }
}

function mountViewer() {
  const route = reactive({ params: { repoName: 'manual', pathMatch: ['guide', 'page.md'] } })
  const wrapper = mount(ViewerLayout, {
    attachTo: document.body,
    global: {
      mocks: { $route: route, $router: { push: vi.fn() } },
      stubs: { NavSidebar: true, MarkdownRenderer: true, SearchOverlay: true, RouterLink: RouterLinkStub }
    }
  })
  return { wrapper, route }
}

let mounted = null
afterEach(() => {
  if (mounted) mounted.unmount()
  mounted = null
  document.body.classList.remove('nav-drawer-open')
})

describe('ViewerLayout navigation on desktop', () => {
  it('shows the sidebar with a collapse button and no menu button', async () => {
    fakeViewport(false)
    const { wrapper } = mountViewer()
    mounted = wrapper
    expect(wrapper.find('.menu-btn').exists()).toBe(false)
    expect(wrapper.find('.viewer-sidebar').isVisible()).toBe(true)
    expect(wrapper.find('.sidebar-backdrop').exists()).toBe(false)

    await wrapper.find('.collapse-btn').trigger('click')
    expect(wrapper.find('.viewer-sidebar').isVisible()).toBe(false)
    expect(wrapper.find('.expand-btn').exists()).toBe(true)
    expect(document.body.classList.contains('nav-drawer-open')).toBe(false)
  })
})

describe('ViewerLayout navigation on a phone', () => {
  it('hides the sidebar behind a menu button and opens it as a drawer', async () => {
    fakeViewport(true)
    const { wrapper } = mountViewer()
    mounted = wrapper
    const menu = wrapper.find('.menu-btn')
    expect(menu.exists()).toBe(true)
    expect(menu.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.viewer-sidebar').isVisible()).toBe(false)
    expect(wrapper.find('.viewer-sidebar').attributes('aria-hidden')).toBe('true')

    await menu.trigger('click')
    await nextTick()
    expect(wrapper.find('.viewer-sidebar').isVisible()).toBe(true)
    expect(wrapper.find('.viewer-sidebar').attributes('aria-hidden')).toBeUndefined()
    expect(wrapper.find('.menu-btn').attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('.sidebar-backdrop').exists()).toBe(true)
    expect(document.body.classList.contains('nav-drawer-open')).toBe(true)
    expect(document.activeElement).toBe(wrapper.find('.collapse-btn').element)
  })

  it('closes the drawer from its close button, the backdrop and Escape', async () => {
    fakeViewport(true)
    const { wrapper } = mountViewer()
    mounted = wrapper

    await wrapper.find('.menu-btn').trigger('click')
    await wrapper.find('.collapse-btn').trigger('click')
    expect(wrapper.find('.viewer-sidebar').isVisible()).toBe(false)
    expect(document.body.classList.contains('nav-drawer-open')).toBe(false)

    await wrapper.find('.menu-btn').trigger('click')
    await wrapper.find('.sidebar-backdrop').trigger('click')
    expect(wrapper.find('.viewer-sidebar').isVisible()).toBe(false)

    await wrapper.find('.menu-btn').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.find('.viewer-sidebar').isVisible()).toBe(false)
    await nextTick()
    expect(document.activeElement).toBe(wrapper.find('.menu-btn').element)
  })

  it('closes the drawer when the route changes', async () => {
    fakeViewport(true)
    const { wrapper, route } = mountViewer()
    mounted = wrapper
    await wrapper.find('.menu-btn').trigger('click')
    expect(wrapper.find('.viewer-sidebar').isVisible()).toBe(true)

    route.params.pathMatch = ['guide', 'other.md']
    await nextTick()
    await nextTick()
    expect(wrapper.find('.viewer-sidebar').isVisible()).toBe(false)
    expect(document.body.classList.contains('nav-drawer-open')).toBe(false)
  })

  it('turns back into the sidebar when the viewport grows, and stops listening on unmount', async () => {
    const viewport = fakeViewport(true)
    const { wrapper } = mountViewer()
    mounted = wrapper
    await wrapper.find('.menu-btn').trigger('click')
    expect(document.body.classList.contains('nav-drawer-open')).toBe(true)

    viewport.resize(false)
    await nextTick()
    expect(wrapper.find('.menu-btn').exists()).toBe(false)
    expect(wrapper.find('.viewer-sidebar').isVisible()).toBe(true)
    expect(wrapper.find('.sidebar-backdrop').exists()).toBe(false)
    expect(document.body.classList.contains('nav-drawer-open')).toBe(false)

    expect(viewport.listeners.size).toBe(1)
    wrapper.unmount()
    mounted = null
    expect(viewport.listeners.size).toBe(0)
  })

  it('marks parent breadcrumbs so phones can collapse them to an ellipsis', () => {
    fakeViewport(true)
    const { wrapper } = mountViewer()
    mounted = wrapper
    const parents = wrapper.findAll('.breadcrumb-link.breadcrumb-parent')
    expect(parents).toHaveLength(1)
    expect(parents[0].text()).toBe('Guide')
    expect(wrapper.find('.breadcrumb-current').text()).toBe('Page')
    expect(wrapper.find('.breadcrumb-current').classes()).not.toContain('breadcrumb-parent')
    expect(wrapper.find('.breadcrumb-ellipsis').exists()).toBe(true)
  })
})
