import { describe, it, expect } from 'vitest'
import { highlightCode, resolveLanguage } from '@/utils/highlight'

describe('highlight', () => {
  it('resolves aliases to registered grammars', () => {
    expect(resolveLanguage('xml')).toBe('markup')
    expect(resolveLanguage('rdfxml')).toBe('markup')
    expect(resolveLanguage('ttl')).toBe('turtle')
    expect(resolveLanguage('jsonld')).toBe('json')
    expect(resolveLanguage('sparql')).toBe('sparql')
    expect(resolveLanguage('py')).toBe('python')
    expect(resolveLanguage('text')).toBeNull()
    expect(resolveLanguage(undefined)).toBeNull()
  })

  it('highlights RDF/XML with namespace tokens', () => {
    const result = highlightCode('<bf:Work rdf:about="http://x/1">t</bf:Work>', 'xml')
    expect(result.language).toBe('markup')
    expect(result.html).toContain('<span class="token namespace">bf:</span>')
    expect(result.html).toContain('class="token attr-name"')
    expect(result.html).toContain('http://x/1')
  })

  it('highlights Turtle prefixed names', () => {
    const result = highlightCode('ex:a a foaf:Person .', 'turtle')
    expect(result.html).toContain('class="token function"')
    expect(result.html).toContain('class="token keyword">a<')
  })

  it('escapes html in code', () => {
    const result = highlightCode('const x = "<b>"', 'js')
    expect(result.html).not.toContain('<b>')
    expect(result.html).toContain('&lt;b')
  })

  it('returns null when no grammar exists', () => {
    expect(highlightCode('anything', 'text')).toBeNull()
  })
})
