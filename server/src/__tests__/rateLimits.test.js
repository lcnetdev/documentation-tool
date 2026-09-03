import { describe, it, expect, beforeAll } from 'vitest';

let limits;
beforeAll(async () => {
  const mod = await import('../middleware/rateLimits.js');
  limits = mod.default ?? mod;
});

describe('rateLimits', () => {
  it('recognises the PDF status poll path', () => {
    expect(limits.isPdfStatusPath({ path: '/repos/documentation-bf-primer/pdf/status' })).toBe(true);
    expect(limits.isPdfStatusPath({ path: '/repos/x/pdf/status/' })).toBe(true);
  });

  it('does not exempt other routes from the general limiter', () => {
    for (const p of ['/repos/x/pdf/download', '/repos/x/pdf/page/index.md', '/repos/x/file/index.md', '/repos', '']) {
      expect(limits.isPdfStatusPath({ path: p })).toBe(false);
    }
    expect(limits.isPdfStatusPath({})).toBe(false);
  });

  it('exports a dedicated limiter for the status poll', () => {
    expect(typeof limits.pdfStatusLimiter).toBe('function');
    expect(typeof limits.apiLimiter).toBe('function');
  });
});
