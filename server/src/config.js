const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Normalize BASE_PATH to always have leading and trailing slashes
const rawBase = process.env.BASE_PATH || '/';
const basePath = '/' + rawBase.replace(/^\/|\/$/g, '').replace(/^$/, '').split('/').filter(Boolean).join('/');
const normalizedBase = basePath === '/' ? '/' : basePath + '/';

const config = {
  port: process.env.PORT || 4580,
  docsDir: path.resolve(__dirname, '../../docs'),
  editorPassword: process.env.EDITOR_PASSWORD || 'changeme',
  gitUser: process.env.GIT_USER || '',
  gitToken: process.env.GIT_TOKEN || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  basePath: normalizedBase,
};

module.exports = config;
