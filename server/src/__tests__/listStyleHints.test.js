import MarkdownIt from 'markdown-it';
import { listStyleHints, parseListStyleHint, LIST_STYLE_CSS } from '../services/listStyleHints';

describe('listStyleHints', () => {
  const md = new MarkdownIt({ html: true }).use(listStyleHints);

  it('parses hint words into classes', () => {
    expect(parseListStyleHint('<!-- LIST_STYLE: compact two-column -->')).toEqual({
      words: ['compact', 'two-column'],
      classes: ['list-compact', 'list-two-column']
    });
    expect(parseListStyleHint('<!-- other -->')).toBeNull();
  });

  it('applies classes to the following list in the export renderer', () => {
    const html = md.render('<!-- LIST_STYLE: compact two-column -->\n\n- a\n- b\n');
    expect(html).toContain('<ul class="list-compact list-two-column">');
    expect(html).not.toContain('LIST_STYLE');
  });

  it('ships css for the export page', () => {
    expect(LIST_STYLE_CSS).toContain('.list-two-column');
  });
});
