/**
 * Simple rate limiter for Airbnb API calls via Zodomus.
 *
 * Zodomus shares rate limits across ALL their clients (~100 calls/sec max).
 * We enforce a minimum 1-second gap between calls to stay well under the limit.
 */
class AirbnbRateLimiter {
  private lastCallMs = 0;
  private readonly minIntervalMs: number;

  constructor(minIntervalMs = 1000) {
    this.minIntervalMs = minIntervalMs;
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallMs;

    if (elapsed < this.minIntervalMs) {
      const waitMs = this.minIntervalMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    this.lastCallMs = Date.now();
  }
}

export const airbnbRateLimiter = new AirbnbRateLimiter();
