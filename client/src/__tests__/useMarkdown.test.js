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

describe('fenced code blocks', () => {
  function render(markdown) {
    const md = createMarkdownRenderer('my-repo', 'index.md', 'view')
    return md.render(markdown)
  }

  it('syntax-highlights known languages', () => {
    const html = render('```js\nconst x = 1\n```')
    expect(html).toContain('<pre><code class="language-js">')
    expect(html).toContain('class="token keyword"')
  })

  it('leaves unknown and untagged languages as escaped text', () => {
    expect(render('```text\n<b>\n```')).toContain('&lt;b&gt;')
    expect(render('```\n<b>\n```')).toContain('&lt;b&gt;')
    expect(render('```text\nplain\n```')).not.toContain('token')
  })

  it('wraps RDF/XML blocks for the tabbed viewer', () => {
    const html = render('```xml\n<bf:Work rdf:about="http://x/1"/>\n```')
    expect(html).toContain('<div class="rdf-block" data-rdf-format="rdfxml"><pre><code class="language-xml">')
    expect(html).toContain('class="token namespace"')
    expect(html).toContain('</code></pre></div>')
  })

  it('wraps explicit rdfxml fences even without rdf attributes', () => {
    const html = render('```rdfxml\n<rdf:RDF/>\n```')
    expect(html).toContain('class="rdf-block"')
  })

  it('lays out a namespace-only rdf:RDF root one declaration per line', () => {
    const html = render('```xml\n<rdf:RDF\n    xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:bf="http://id.loc.gov/ontologies/bibframe/"\n    />\n```')
    const text = html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    expect(html).toContain('class="rdf-block"')
    expect(text).toContain('<rdf:RDF\n    xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"\n    xmlns:bf="http://id.loc.gov/ontologies/bibframe/"\n/>')
  })

  it('does not wrap ordinary xml', () => {
    const html = render('```xml\n<record><leader>x</leader></record>\n```')
    expect(html).not.toContain('rdf-block')
    expect(html).toContain('class="token tag"')
  })

  it('still renders mermaid blocks as diagrams', () => {
    const html = render('```mermaid\ngraph LR; A-->B\n```')
    expect(html).toContain('<pre class="mermaid">')
    expect(html).not.toContain('token')
  })
})

describe('LIST_STYLE rendering hints', () => {
  function render(markdown) {
    const md = createMarkdownRenderer('my-repo', 'index.md', 'view')
    return md.render(markdown)
  }

  it('tags the following list with layout classes and drops the comment', () => {
    const html = render('<!-- LIST_STYLE: compact two-column -->\n\n- [bf:classification](https://x/#p_classification)\n- [bf:content](https://x/#p_content)\n')
    expect(html).toContain('<ul class="list-compact list-two-column">')
    expect(html).not.toContain('LIST_STYLE')
    expect(html).toContain('bf:classification')
  })

  it('works without a blank line, with commas, and on ordered lists', () => {
    const html = render('<!-- LIST_STYLE: compact, three-column -->\n1. a\n2. b\n')
    expect(html).toContain('<ol class="list-compact list-three-column">')
  })

  it('ignores unknown words and hints not followed by a list', () => {
    expect(render('<!-- LIST_STYLE: sparkly -->\n\n- a\n')).toContain('<ul>')
    const html = render('<!-- LIST_STYLE: compact -->\n\nA paragraph.\n\n- a\n')
    expect(html).toContain('<ul>')
    expect(html).not.toContain('list-compact')
    expect(html).not.toContain('LIST_STYLE')
  })

  it('leaves other comments and lists alone', () => {
    const html = render('<!-- just a note -->\n\n- a\n')
    expect(html).toContain('<!-- just a note -->')
    expect(html).toContain('<ul>')
  })
})
