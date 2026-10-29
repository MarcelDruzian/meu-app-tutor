export function createRateLimiter({ limit, windowMs, cleanupIntervalMs = windowMs }) {
  const entries = new Map();
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) {
        entries.delete(key);
      }
    }
  }, cleanupIntervalMs);
  cleanupTimer.unref();

  return {
    consume(key, now = Date.now()) {
      let entry = entries.get(key);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + windowMs };
        entries.set(key, entry);
      }

      entry.count += 1;
      if (entry.count > limit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
        };
      }

      return { allowed: true, retryAfterSeconds: 0 };
    }
  };
}
