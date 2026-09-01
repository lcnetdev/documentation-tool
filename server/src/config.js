const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Normalize BASE_PATH to always have leading and trailing slashes
const rawBase = process.env.BASE_PATH || '/';
const basePath = '/' + rawBase.replace(/^\/|\/$/g, '').replace(/^$/, '').split('/').filter(Boolean).join('/');
const normalizedBase = basePath === '/' ? '/' : basePath + '/';

const config = {
  port: process.env.PORT || 4580,
  docsDir: path.resolve(__dirname, '../../docs'),
  // No default: startup fails if unset (see index.js); auth rejects empty
  editorPassword: process.env.EDITOR_PASSWORD || '',
  gitUser: process.env.GIT_USER || '',
  gitToken: process.env.GIT_TOKEN || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  basePath: normalizedBase,
  gitPushEnabled: process.env.GIT_PUSH_ENABLED !== 'false',
  // Folders inside a docs repo that carry non-documentation material
  // (conversion scripts, source documents). Kept out of the tree, search
  // and file routes.
  ignoredDirs: (process.env.IGNORED_DIRS === undefined ? 'meta-conversion' : process.env.IGNORED_DIRS)
    .split(',').map((s) => s.trim()).filter(Boolean),
};

module.exports = config;
