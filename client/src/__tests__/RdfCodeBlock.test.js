import { describe, it, expect, beforeAll, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RdfCodeBlock from '@/components/viewer/RdfCodeBlock.vue'
import MarkdownRenderer from '@/components/viewer/MarkdownRenderer.vue'

const SOURCE = `<bf:Hub rdf:about="http://id.loc.gov/resources/hubs/1">
  <bflc:aap>Homer. Odyssey. English</bflc:aap>
  <bf:language rdf:resource="http://id.loc.gov/vocabulary/languages/eng"/>
</bf:Hub>
`

// Conversion pulls the RDF utilities (and dagre) in as a lazy chunk, which
// takes actual wall-clock time under vitest — hence polling with a timeout
// instead of flushing microtasks.
async function settle(wrapper, predicate, timeoutMs = 10000) {
  const start = Date.now()
  for (;;) {
    await flushPromises()
    await wrapper.vm.$nextTick()
    if (predicate() || Date.now() - start > timeoutMs) return
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

beforeAll(() => {
  // no canvas in jsdom, so the graph measures text by estimate instead
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null)
})

describe('RdfCodeBlock', () => {
  it('shows the highlighted source by default', () => {
    const wrapper = mount(RdfCodeBlock, {
      props: { source: SOURCE, sourceHtml: '<span class="token tag">x</span>' }
    })
    const tabs = wrapper.findAll('[role="tab"]').map(t => t.text())
    expect(tabs).toEqual(['RDF/XML', 'JSON-LD', 'Turtle', 'Graph'])
    expect(wrapper.find('code.language-xml').html()).toContain('token tag')
  })

  it('converts to Turtle and JSON-LD on demand', async () => {
    const wrapper = mount(RdfCodeBlock, { props: { source: SOURCE, sourceHtml: '' } })
    await wrapper.findAll('[role="tab"]')[2].trigger('click')
    await settle(wrapper, () => wrapper.find('code.language-turtle').exists())
    const turtle = wrapper.find('code.language-turtle').text()
    expect(turtle).toContain('@prefix bf: <http://id.loc.gov/ontologies/bibframe/> .')
    expect(turtle).toContain('a bf:Hub')
    expect(turtle).toContain('bflc:aap "Homer. Odyssey. English"')
    expect(wrapper.find('.rdf-meta').text()).toBe('3 triples')

    await wrapper.findAll('[role="tab"]')[1].trigger('click')
    await settle(wrapper, () => wrapper.find('code.language-json').exists())
    expect(wrapper.find('code.language-json').text()).toContain('"@type": "bf:Hub"')
  })

  it('renders the graph tab as an SVG with labeled nodes and edges', async () => {
    const wrapper = mount(RdfCodeBlock, { props: { source: SOURCE, sourceHtml: '' } })
    await wrapper.findAll('[role="tab"]')[3].trigger('click')
    await settle(wrapper, () => wrapper.find('svg').exists())
    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.findAll('.rdf-node')).toHaveLength(4)
    expect(svg.findAll('.rdf-edge')).toHaveLength(3)
    expect(svg.text()).toContain('bflc:aap')
    expect(svg.text()).toContain('"Homer. Odyssey. English"')
    expect(svg.find('.rdf-node-class').exists()).toBe(true)
    expect(svg.find('.rdf-node-literal').exists()).toBe(true)
  })

  it('reports parse errors instead of crashing', async () => {
    const wrapper = mount(RdfCodeBlock, { props: { source: '<rdf:RDF><bf:Work></rdf:RDF>', sourceHtml: '' } })
    await wrapper.findAll('[role="tab"]')[1].trigger('click')
    await settle(wrapper, () => wrapper.find('.rdf-error').exists())
    expect(wrapper.find('.rdf-error').text()).toContain('Could not parse this block as RDF/XML.')
    expect(wrapper.find('.rdf-error-detail').text()).toMatch(/Line \d+/)
  })
})

describe('MarkdownRenderer RDF integration', () => {
  it('mounts the tabbed viewer into rdf-block wrappers', async () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: 'Intro\n\n```xml\n' + SOURCE + '```\n', repoName: 'r', currentFile: 'a.md' },
      global: { mocks: { $router: { push: vi.fn() } } }
    })
    await settle(wrapper, () => wrapper.find('.rdf-block [role="tablist"]').exists())
    expect(wrapper.find('.rdf-block [role="tablist"]').exists()).toBe(true)
    expect(wrapper.find('.rdf-block code.language-xml').text()).toContain('bflc:aap')
    expect(wrapper.vm.rdfApps).toHaveLength(1)

    await wrapper.setProps({ content: 'No RDF here' })
    await settle(wrapper, () => wrapper.vm.rdfApps.length === 0)
    expect(wrapper.vm.rdfApps).toHaveLength(0)
    expect(wrapper.find('.rdf-block').exists()).toBe(false)
  })
})
