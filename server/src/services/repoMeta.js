const path = require('path');
const fs = require('fs');
const config = require('../config');

const META_FILE = path.join(config.docsDir, '.repos-meta.json');

class RepoMeta {
  read() {
    if (!fs.existsSync(META_FILE)) {
      return { repos: {} };
    }
    try {
      const raw = fs.readFileSync(META_FILE, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return { repos: {} };
    }
  }

  write(meta) {
    fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf-8');
  }

  get(repoName) {
    const meta = this.read();
    return meta.repos[repoName] || null;
  }

  registerOriginal(repoName) {
    const meta = this.read();
    if (!meta.repos[repoName]) {
      meta.repos[repoName] = {
        type: 'original',
        createdAt: new Date().toISOString()
      };
      this.write(meta);
    }
  }

  registerBranch(dirName, parentRepo, branchName, createdBy) {
    const meta = this.read();
    meta.repos[dirName] = {
      type: 'branch',
      parentRepo,
      branchName,
      createdBy,
      createdAt: new Date().toISOString()
    };
    this.write(meta);
  }

  remove(repoName) {
    const meta = this.read();
    delete meta.repos[repoName];
    this.write(meta);
  }

  listAll() {
    const meta = this.read();
    if (!fs.existsSync(config.docsDir)) return [];

    const entries = fs.readdirSync(config.docsDir, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory() && e.name !== '.git')
      .map(e => e.name);

    return dirs.map(name => ({
      name,
      ...(meta.repos[name] || { type: 'original' })
    }));
  }

  getBranches(parentRepo) {
    const meta = this.read();
    return Object.entries(meta.repos)
      .filter(([, v]) => v.type === 'branch' && v.parentRepo === parentRepo)
      .map(([name, v]) => ({ name, ...v }));
  }

  /**
   * Ensure all existing directories in docs/ have metadata entries.
   * Directories without entries are registered as originals.
   */
  seedExisting() {
    if (!fs.existsSync(config.docsDir)) return;

    const meta = this.read();
    const entries = fs.readdirSync(config.docsDir, { withFileTypes: true });
    let changed = false;

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== '.git' && !meta.repos[entry.name]) {
        meta.repos[entry.name] = {
          type: 'original',
          createdAt: new Date().toISOString()
        };
        changed = true;
      }
    }

    if (changed) {
      this.write(meta);
    }
  }
}

module.exports = RepoMeta;
