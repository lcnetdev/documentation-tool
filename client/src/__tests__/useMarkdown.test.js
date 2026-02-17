import { describe, it, expect } from 'vitest'
import { createMarkdownRenderer } from '@/composables/useMarkdown'

describe('createMarkdownRenderer', () => {
  const repoName = 'my-repo'
  const currentFile = 'work-description/title.md'
  const mode = 'view'

  function render(markdown) {
    const md = createMarkdownRenderer(repoName, currentFile, mode)
    return md.render(markdown)
  }

  it('renders a heading', () => {
    const html = render('# Hello World')
    expect(html).toContain('<h1')
    expect(html).toContain('Hello World')
  })

  it('renders a paragraph', () => {
    const html = render('Some paragraph text.')
    expect(html).toContain('<p>')
    expect(html).toContain('Some paragraph text.')
  })

  it('renders multiple headings at different levels', () => {
    const html = render('## Second\n\n### Third')
    expect(html).toContain('<h2')
    expect(html).toContain('Second')
    expect(html).toContain('<h3')
    expect(html).toContain('Third')
  })

  describe('image rendering', () => {
    it('rewrites a relative image src to an API URL', () => {
      const html = render('![photo](../images/foo.png)')
      expect(html).toContain('src="/api/repos/my-repo/images/foo.png"')
    })

    it('adds the doc-image class to images', () => {
      const html = render('![photo](../images/foo.png)')
      expect(html).toContain('class="doc-image"')
    })

    it('does not rewrite absolute http image URLs', () => {
      const html = render('![logo](https://example.com/logo.png)')
      expect(html).toContain('src="https://example.com/logo.png"')
    })

    it('still adds doc-image class to external images', () => {
      const html = render('![logo](https://example.com/logo.png)')
      expect(html).toContain('class="doc-image"')
    })
  })

  describe('link rendering', () => {
    it('rewrites a relative .md link to a /view/ route', () => {
      const html = render('[Go to index](../index.md)')
      expect(html).toContain('href="/view/my-repo/index.md"')
    })

    it('rewrites a .md link with hash fragment', () => {
      const html = render('[Section](../appendices/a.md#intro)')
      expect(html).toContain('href="/view/my-repo/appendices/a.md#intro"')
    })

    it('uses the mode parameter in rewritten links', () => {
      const md = createMarkdownRenderer(repoName, currentFile, 'edit')
      const html = md.render('[Go to index](../index.md)')
      expect(html).toContain('href="/edit/my-repo/index.md"')
    })

    it('leaves external links unchanged and adds target _blank', () => {
      const html = render('[Google](https://google.com)')
      expect(html).toContain('href="https://google.com"')
      expect(html).toContain('target="_blank"')
      expect(html).toContain('rel="noopener noreferrer"')
    })

    it('leaves anchor-only links unchanged', () => {
      const html = render('[Jump](#section)')
      expect(html).toContain('href="#section"')
    })
  })
})
