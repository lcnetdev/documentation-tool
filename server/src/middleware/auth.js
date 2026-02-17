const config = require('../config');

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
  const [username, password] = credentials.split(':');

  if (!password || password !== config.editorPassword) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Documentation Editor"');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.user = { username: username || 'anonymous' };
  next();
}

module.exports = auth;
