// Small in-memory sliding-window limiter. On serverless hosts each instance has its own
// memory, so security-critical limits (contact form) are ALSO enforced via the database.
import { ApiError } from './http.js';

const buckets = new Map();

export function rateLimit({ name, windowMs, max }) {
  return (req, _res, next) => {
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
    const key = `${name}:${ip}`;
    const now = Date.now();
    const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
    if (hits.length >= max) {
      const retry = Math.ceil((windowMs - (now - hits[0])) / 1000);
      return next(new ApiError(429, 'rate_limited', `Too many requests. Try again in ${retry}s.`, { retryAfter: retry }));
    }
    hits.push(now);
    buckets.set(key, hits);
    if (buckets.size > 5000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
    next();
  };
}
