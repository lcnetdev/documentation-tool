import { describe, it, expect } from 'vitest'
import { computeRelativePath, resolveRelativePath } from '@/utils/relativePath'

describe('computeRelativePath', () => {
  it('navigates up from a subdirectory to a sibling directory', () => {
    expect(computeRelativePath('work-description/title.md', 'images/foo.png'))
      .toBe('../images/foo.png')
  })

  it('navigates into a subdirectory from the root', () => {
    expect(computeRelativePath('index.md', 'work-description/title.md'))
      .toBe('./work-description/title.md')
  })

  it('references a sibling file in the same directory', () => {
    expect(computeRelativePath('appendices/a.md', 'appendices/b.md'))
      .toBe('./b.md')
  })

  it('navigates up multiple levels', () => {
    expect(computeRelativePath('a/b/c.md', 'x.md'))
      .toBe('../../x.md')
  })

  it('handles files both in the root directory', () => {
    expect(computeRelativePath('readme.md', 'license.md'))
      .toBe('./license.md')
  })
})

describe('resolveRelativePath', () => {
  it('resolves a parent-relative path from a subdirectory', () => {
    expect(resolveRelativePath('work-description/title.md', '../images/foo.png'))
      .toBe('images/foo.png')
  })

  it('resolves a path without dot-dot from the root', () => {
    expect(resolveRelativePath('index.md', 'work-description/title.md'))
      .toBe('work-description/title.md')
  })

  it('resolves a parent-relative path back to the root', () => {
    expect(resolveRelativePath('work-description/title.md', '../index.md'))
      .toBe('index.md')
  })

  it('resolves a dot-slash relative path in the same directory', () => {
    expect(resolveRelativePath('appendices/a.md', './b.md'))
      .toBe('appendices/b.md')
  })

  it('resolves multiple parent traversals', () => {
    expect(resolveRelativePath('a/b/c.md', '../../x.md'))
      .toBe('x.md')
  })
})
