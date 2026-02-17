import { vi } from 'vitest';

// Set environment variable BEFORE importing auth, so config.js picks it up.
process.env.EDITOR_PASSWORD = 'test-secret-password';

// Force fresh import of config and auth by clearing the require cache.
// Vitest runs tests in a worker, so this effectively sets the password
// for all tests in this file.

let auth;
beforeAll(async () => {
  const mod = await import('../middleware/auth.js');
  auth = mod.default ?? mod;
});

function createMocks(authHeader) {
  const req = { headers: {} };
  if (authHeader !== undefined) {
    req.headers.authorization = authHeader;
  }
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    setHeader(name, value) { this.headers[name] = value; },
  };
  const next = vi.fn();
  return { req, res, next };
}

function basicAuth(username, password) {
  const encoded = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${encoded}`;
}

describe('auth middleware', () => {
  it('returns 401 without authorization header', () => {
    const { req, res, next } = createMocks();
    auth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with wrong password', () => {
    const { req, res, next } = createMocks(basicAuth('admin', 'wrong-password'));
    auth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes with correct password and calls next()', () => {
    const { req, res, next } = createMocks(basicAuth('editor', 'test-secret-password'));
    auth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBeNull();
  });

  it('sets req.user.username from credentials', () => {
    const { req, res, next } = createMocks(basicAuth('alice', 'test-secret-password'));
    auth(req, res, next);
    expect(req.user).toEqual({ username: 'alice' });
    expect(next).toHaveBeenCalledOnce();
  });
});
