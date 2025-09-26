export class RateLimiter {
  private attempts = new Map<string, number[]>();

  isAllowed(key: string, maxAttempts = 10, windowMs = 1000): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    for (const [cmd, timestamps] of this.attempts) {
      this.attempts.set(cmd, timestamps.filter(t => t > windowStart));
    }

    const timestamps = this.attempts.get(key) || [];
    if (timestamps.length >= maxAttempts) {
      return false;
    }

    timestamps.push(now);
    this.attempts.set(key, timestamps);
    return true;
  }
}
