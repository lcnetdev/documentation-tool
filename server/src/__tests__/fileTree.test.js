import fs from 'fs';
import os from 'os';
import path from 'path';
import { getTree, readFile, parseNav } from '../services/fileTree.js';

describe('fileTree', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filetree-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('getTree', () => {
    it('returns correct structure for a directory with markdown files', () => {
      fs.mkdirSync(path.join(tmpDir, 'guide'));
      fs.writeFileSync(path.join(tmpDir, 'guide', 'intro.md'), '# Intro');
      fs.writeFileSync(path.join(tmpDir, 'guide', 'advanced.md'), '# Advanced');
      fs.writeFileSync(path.join(tmpDir, 'readme.md'), '# Readme');
      fs.writeFileSync(path.join(tmpDir, 'notes.txt'), 'plain text');

      const tree = getTree(tmpDir);

      expect(tree).toHaveLength(2);
      expect(tree[0].name).toBe('guide');
      expect(tree[0].type).toBe('directory');
      expect(tree[0].children).toHaveLength(2);
      expect(tree[1].name).toBe('readme.md');
      expect(tree[1].type).toBe('file');
    });

    it('excludes .git directory', () => {
      fs.mkdirSync(path.join(tmpDir, '.git'));
      fs.writeFileSync(path.join(tmpDir, '.git', 'HEAD'), 'ref: refs/heads/main');
      fs.writeFileSync(path.join(tmpDir, 'doc.md'), '# Doc');

      const tree = getTree(tmpDir);
      const names = tree.map((e) => e.name);
      expect(names).not.toContain('.git');
      expect(names).toContain('doc.md');
    });
  });

  describe('readFile', () => {
    it('returns file content', () => {
      fs.writeFileSync(path.join(tmpDir, 'test.md'), 'Hello, World!');
      const content = readFile(tmpDir, 'test.md');
      expect(content).toBe('Hello, World!');
    });

    it('throws for missing files', () => {
      expect(() => readFile(tmpDir, 'missing.md')).toThrow();
    });
  });

  describe('parseNav', () => {
    it('extracts links from index.md', () => {
      const indexContent = [
        '# Navigation',
        '',
        '- [Getting Started](getting-started.md)',
        '- [API Reference](api/reference.md)',
        '- [FAQ](faq.md)',
      ].join('\n');

      fs.writeFileSync(path.join(tmpDir, 'index.md'), indexContent);

      const nav = parseNav(tmpDir);
      expect(nav).toHaveLength(3);
      expect(nav[0]).toEqual({ title: 'Getting Started', path: 'getting-started.md' });
      expect(nav[1]).toEqual({ title: 'API Reference', path: 'api/reference.md' });
      expect(nav[2]).toEqual({ title: 'FAQ', path: 'faq.md' });
    });

    it('returns empty array when index.md does not exist', () => {
      const nav = parseNav(tmpDir);
      expect(nav).toEqual([]);
    });
  });
});
