import fs from 'fs';
import os from 'os';
import path from 'path';
import SearchService from '../services/search.js';

describe('SearchService', () => {
  let tmpDir;
  let searchService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'search-test-'));
    searchService = new SearchService();

    fs.writeFileSync(
      path.join(tmpDir, 'guide.md'),
      '# Getting Started\n\nWelcome to the documentation.\nThis guide helps you get up and running.\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'api.md'),
      '# API Reference\n\nThe API provides endpoints for managing documents.\nAuthentication is required for all endpoints.\n'
    );

    fs.mkdirSync(path.join(tmpDir, 'advanced'));
    fs.writeFileSync(
      path.join(tmpDir, 'advanced', 'config.md'),
      '# Configuration\n\nAdvanced configuration options.\nSet the API key in your environment.\n'
    );

    fs.writeFileSync(path.join(tmpDir, 'notes.txt'), 'This should not be indexed.');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('buildIndex', () => {
    it('indexes all markdown files including nested ones', () => {
      searchService.buildIndex('test-repo', tmpDir);
      const result = searchService.search('test-repo', 'Getting Started');
      expect(result.results.length).toBeGreaterThanOrEqual(1);
    });

    it('does not index non-markdown files', () => {
      searchService.buildIndex('test-repo', tmpDir);
      const result = searchService.search('test-repo', 'should not be indexed');
      expect(result.results).toHaveLength(0);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      searchService.buildIndex('test-repo', tmpDir);
    });

    it('returns matches with correct file paths', () => {
      const result = searchService.search('test-repo', 'API');
      expect(result.results.length).toBeGreaterThanOrEqual(1);
      const filePaths = result.results.map((r) => r.file);
      expect(filePaths).toContain('api.md');
    });

    it('is case-insensitive', () => {
      const lower = searchService.search('test-repo', 'authentication');
      const upper = searchService.search('test-repo', 'AUTHENTICATION');
      expect(lower.totalMatches).toBeGreaterThan(0);
      expect(lower.totalMatches).toBe(upper.totalMatches);
    });

    it('returns empty results for empty query', () => {
      const result = searchService.search('test-repo', '');
      expect(result.results).toEqual([]);
      expect(result.totalMatches).toBe(0);
    });

    it('returns empty results for non-indexed repo', () => {
      const result = searchService.search('unknown-repo', 'anything');
      expect(result.results).toEqual([]);
      expect(result.totalMatches).toBe(0);
    });
  });
});
