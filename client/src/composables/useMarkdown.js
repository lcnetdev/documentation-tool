import MarkdownIt from 'markdown-it'
import markdownItAnchor from 'markdown-it-anchor'
import { resolveRelativePath } from '@/utils/relativePath'
import { withBase } from '@/utils/basePath'

/**
 * Creates a configured markdown-it instance with custom image and link rendering.
 *
 * @param {string} repoName - The repository name
 * @param {string} currentFilePath - The current file path (e.g. "work-description/title-information.md")
 * @param {string} mode - 'view' or 'edit'
 * @returns {MarkdownIt} Configured markdown-it instance
 */
export function createMarkdownRenderer(repoName, currentFilePath, mode) {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: true
  })

  md.use(markdownItAnchor)

  // Custom fence renderer for mermaid blocks
  const defaultFence = md.renderer.rules.fence
  md.renderer.rules.fence = function (tokens, idx, options, env, self) {
    const token = tokens[idx]
    if (token.info.trim().toLowerCase() === 'mermaid') {
      return '<pre class="mermaid">' + escapeHtml(token.content) + '</pre>'
    }
    if (defaultFence) {
      return defaultFence(tokens, idx, options, env, self)
    }
    return self.renderToken(tokens, idx, options)
  }

  // Store default renderers
  const defaultImageRender = md.renderer.rules.image || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options)
  }

  const defaultLinkOpen = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options)
  }

  const defaultLinkClose = md.renderer.rules.link_close || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options)
  }

  // Custom image renderer
  md.renderer.rules.image = function (tokens, idx, options, env, self) {
    const token = tokens[idx]
    const srcIndex = token.attrIndex('src')

    if (srcIndex >= 0) {
      let src = token.attrs[srcIndex][1]

      // If the src is relative (not http/https and not starting with /), resolve it
      if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('/')) {
        const resolved = resolveRelativePath(currentFilePath, src)
        token.attrs[srcIndex][1] = withBase('/api/repos/' + repoName + '/images/' + resolved.replace(/^images\//, ''))
      }
    }

    // Add doc-image class
    const classIndex = token.attrIndex('class')
    if (classIndex >= 0) {
      token.attrs[classIndex][1] += ' doc-image'
    } else {
      token.attrPush(['class', 'doc-image'])
    }

    // Get alt text from children tokens (markdown-it stores alt as inline children)
    const alt = token.children ? md.renderer.renderInlineAsText(token.children, options, env) : (token.content || '')
    // Remove the empty alt attr that markdown-it adds by default, we set it manually
    const altIndex = token.attrIndex('alt')
    if (altIndex >= 0) {
      token.attrs.splice(altIndex, 1)
    }
    const attrs = token.attrs.map(function (attr) {
      return attr[0] + '="' + escapeHtml(attr[1]) + '"'
    }).join(' ')

    const imgTag = '<img ' + attrs + ' alt="' + escapeHtml(alt) + '" title="' + escapeHtml(alt) + '" />'
    if (alt && alt.toLowerCase() !== 'image') {
      return '<figure class="doc-figure">' + imgTag + '<figcaption>' + escapeHtml(alt) + '</figcaption></figure>'
    }
    return imgTag
  }

  // Custom link renderer
  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    const token = tokens[idx]
    const hrefIndex = token.attrIndex('href')

    if (hrefIndex >= 0) {
      let href = token.attrs[hrefIndex][1]

      if (href && !href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('#') && !href.startsWith('/')) {
        // Check if it's a .md link
        if (href.endsWith('.md') || href.includes('.md#')) {
          // Split href and hash
          let hashPart = ''
          let filePart = href
          const hashIndex = href.indexOf('#')
          if (hashIndex >= 0) {
            hashPart = href.substring(hashIndex)
            filePart = href.substring(0, hashIndex)
          }

          const resolved = resolveRelativePath(currentFilePath, filePart)
          const routeMode = mode || 'view'
          token.attrs[hrefIndex][1] = '/' + routeMode + '/' + repoName + '/' + resolved + hashPart
        }
      } else if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        // External link: open in new tab
        token.attrPush(['target', '_blank'])
        token.attrPush(['rel', 'noopener noreferrer'])
      }
    }

    return self.renderToken(tokens, idx, options)
  }

  md.renderer.rules.link_close = function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options)
  }

  return md
}

function escapeHtml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
