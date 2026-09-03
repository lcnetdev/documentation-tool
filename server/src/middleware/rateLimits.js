const rateLimit = require('express-rate-limit');

/**
 * The viewer polls this while a manual PDF builds. It is an in-memory lookup,
 * so it gets its own budget (pdfStatusLimiter) instead of sharing the general
 * one: a stale tab that polls forever must not turn page loads into 429s.
 */
function isPdfStatusPath(req) {
  return /\/pdf\/status\/?$/.test(req.path || '');
}

/**
 * General ceiling for all API traffic, per IP.
 */
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isPdfStatusPath,
  message: { error: 'Too many requests, please slow down' },
});

/**
 * Separate budget for the PDF status poll (see isPdfStatusPath). Deliberately
 * huge: the lookup is free, and a whole office behind one NAT with old tabs
 * still polling every 5 s must never be told to slow down.
 */
const pdfStatusLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 6000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many status checks, please slow down' },
});

/**
 * Tight limit for CPU-heavy public endpoints (per-page PDF/HTML generation,
 * search index builds) — these are synchronous and can starve the event loop.
 */
const heavyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
});

/**
 * Search fires on typing pauses, so it gets a more generous limit than the
 * PDF/HTML generators — after the first index build per repo it's cheap.
 */
const searchLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many search requests, please slow down' },
});

/**
 * Brute-force protection for the shared editor password.
 * Only 401 responses count toward the limit, so a logged-in editor
 * hitting ordinary errors is not locked out.
 */
const authFailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  requestWasSuccessful: (req, res) => res.statusCode !== 401,
  skipSuccessfulRequests: true,
  message: { error: 'Too many failed authentication attempts, try again later' },
});

module.exports = { apiLimiter, heavyLimiter, searchLimiter, authFailLimiter, pdfStatusLimiter, isPdfStatusPath };
