const rateLimit = require('express-rate-limit');

/**
 * General ceiling for all API traffic, per IP.
 */
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
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

module.exports = { apiLimiter, heavyLimiter, searchLimiter, authFailLimiter };
