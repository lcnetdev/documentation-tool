import { describe, it, expect } from 'vitest';
import { highlightCode, resolveLanguage, TOKEN_CSS } from '../services/highlight';

describe('server highlight', () => {
  it('resolves aliases to Prism grammars', () => {
    expect(resolveLanguage('xml')).toBe('markup');
    expect(resolveLanguage('rdfxml')).toBe('markup');
    expect(resolveLanguage('ttl')).toBe('turtle');
    expect(resolveLanguage('JS')).toBe('javascript');
    expect(resolveLanguage('nope')).toBeNull();
    expect(resolveLanguage('')).toBeNull();
  });

  it('highlights RDF/XML with namespace-aware tag tokens', () => {
    const result = highlightCode('<bf:Work rdf:about="http://x/1"/>', 'xml');
    expect(result.language).toBe('markup');
    expect(result.html).toContain('class="token namespace"');
    expect(result.html).toContain('class="token attr-name"');
    expect(result.html).toContain('http://x/1');
  });

  it('highlights Turtle', () => {
    const result = highlightCode('@prefix bf: <http://id.loc.gov/ontologies/bibframe/> .\n<http://x/1> a bf:Work .', 'turtle');
    expect(result.html).toContain('token keyword');
    expect(result.html).toContain('token url');
  });

  it('returns null for unknown languages', () => {
    expect(highlightCode('plain', 'text')).toBeNull();
  });

  it('exports token css for the exported page', () => {
    expect(TOKEN_CSS).toContain('.token.tag');
  });
});
