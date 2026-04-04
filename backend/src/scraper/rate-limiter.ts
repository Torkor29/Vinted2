interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private readonly maxTokens: number;
  private readonly refillRateMs: number;

  constructor(requestsPerSecond: number = 0.5) {
    this.maxTokens = 1;
    this.refillRateMs = 1000 / requestsPerSecond;
  }

  async acquire(key: string = 'default'): Promise<void> {
    let bucket = this.buckets.get(key);
    const now = Date.now();

    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = elapsed / this.refillRateMs;
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return;
    }

    // Wait for next token
    const waitMs = (1 - bucket.tokens) * this.refillRateMs;
    await sleep(waitMs + randomJitter(50, 200));
    bucket.tokens = 0;
    bucket.lastRefill = Date.now();
  }

  clear(): void {
    this.buckets.clear();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomJitter(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
