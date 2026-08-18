const crypto = require('crypto');
const config = require('../config');

/**
 * Constant-time string comparison. Both inputs are hashed first so
 * length differences don't short-circuit the comparison.
 */
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * HTTP Basic Auth middleware.
 * Accepts any username but the password must match config.editorPassword.
 * Attaches req.user = { username } on success.
 * Returns 401 with WWW-Authenticate header if credentials are missing or invalid.
 */
function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Documentation Editor"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  // Split on the first colon only — passwords may contain colons
  const sep = credentials.indexOf(':');
  const username = sep >= 0 ? credentials.slice(0, sep) : credentials;
  const password = sep >= 0 ? credentials.slice(sep + 1) : '';

  if (!password || !config.editorPassword || !safeEqual(password, config.editorPassword)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Documentation Editor"');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.user = { username: username || 'anonymous' };
  next();
}

module.exports = auth;
