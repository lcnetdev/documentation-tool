import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EditorToolbar from '@/components/editor/EditorToolbar.vue'

describe('EditorToolbar', () => {
  it('renders all toolbar buttons', () => {
    const wrapper = mount(EditorToolbar)
    const buttons = wrapper.findAll('.toolbar-btn')
    // The component defines 13 buttons
    expect(buttons.length).toBe(13)
  })

  it('renders button labels as title attributes', () => {
    const wrapper = mount(EditorToolbar)
    const buttons = wrapper.findAll('.toolbar-btn')
    const titles = buttons.map(b => b.attributes('title'))
    expect(titles).toContain('Bold')
    expect(titles).toContain('Italic')
    expect(titles).toContain('Heading 1')
    expect(titles).toContain('Link')
    expect(titles).toContain('Code Block')
  })

  it('renders button icon text', () => {
    const wrapper = mount(EditorToolbar)
    const buttons = wrapper.findAll('.toolbar-btn')
    const texts = buttons.map(b => b.text())
    expect(texts).toContain('H1')
    expect(texts).toContain('H2')
    expect(texts).toContain('B')
    expect(texts).toContain('I')
    expect(texts).toContain('{ }')
  })

  it('emits action event with type and payload when Bold button is clicked', async () => {
    const wrapper = mount(EditorToolbar)
    const boldBtn = wrapper.findAll('.toolbar-btn').find(b => b.attributes('title') === 'Bold')
    await boldBtn.trigger('click')

    const emitted = wrapper.emitted('action')
    expect(emitted).toBeTruthy()
    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toEqual(['wrap', '**'])
  })

  it('emits action event with heading type when H1 button is clicked', async () => {
    const wrapper = mount(EditorToolbar)
    const h1Btn = wrapper.findAll('.toolbar-btn').find(b => b.attributes('title') === 'Heading 1')
    await h1Btn.trigger('click')

    const emitted = wrapper.emitted('action')
    expect(emitted).toBeTruthy()
    expect(emitted[0]).toEqual(['heading', '# '])
  })

  it('emits action event with heading type when H2 button is clicked', async () => {
    const wrapper = mount(EditorToolbar)
    const h2Btn = wrapper.findAll('.toolbar-btn').find(b => b.attributes('title') === 'Heading 2')
    await h2Btn.trigger('click')

    const emitted = wrapper.emitted('action')
    expect(emitted[0]).toEqual(['heading', '## '])
  })

  it('emits action event with wrap type when Italic button is clicked', async () => {
    const wrapper = mount(EditorToolbar)
    const italicBtn = wrapper.findAll('.toolbar-btn').find(b => b.attributes('title') === 'Italic')
    await italicBtn.trigger('click')

    const emitted = wrapper.emitted('action')
    expect(emitted[0]).toEqual(['wrap', '*'])
  })

  it('emits action event with insert type when Link button is clicked', async () => {
    const wrapper = mount(EditorToolbar)
    const linkBtn = wrapper.findAll('.toolbar-btn').find(b => b.attributes('title') === 'Link')
    await linkBtn.trigger('click')

    const emitted = wrapper.emitted('action')
    expect(emitted[0]).toEqual(['insert', '[text](url)'])
  })

  it('emits action event with block type when Code Block button is clicked', async () => {
    const wrapper = mount(EditorToolbar)
    const codeBtn = wrapper.findAll('.toolbar-btn').find(b => b.attributes('title') === 'Code Block')
    await codeBtn.trigger('click')

    const emitted = wrapper.emitted('action')
    expect(emitted[0]).toEqual(['block', '```\n\n```'])
  })

  it('emits action event with line type when Unordered List button is clicked', async () => {
    const wrapper = mount(EditorToolbar)
    const ulBtn = wrapper.findAll('.toolbar-btn').find(b => b.attributes('title') === 'Unordered List')
    await ulBtn.trigger('click')

    const emitted = wrapper.emitted('action')
    expect(emitted[0]).toEqual(['line', '- '])
  })

  it('emits multiple action events when multiple buttons are clicked', async () => {
    const wrapper = mount(EditorToolbar)
    const boldBtn = wrapper.findAll('.toolbar-btn').find(b => b.attributes('title') === 'Bold')
    const italicBtn = wrapper.findAll('.toolbar-btn').find(b => b.attributes('title') === 'Italic')

    await boldBtn.trigger('click')
    await italicBtn.trigger('click')

    const emitted = wrapper.emitted('action')
    expect(emitted).toHaveLength(2)
    expect(emitted[0]).toEqual(['wrap', '**'])
    expect(emitted[1]).toEqual(['wrap', '*'])
  })
})
