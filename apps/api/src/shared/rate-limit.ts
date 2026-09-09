interface Bucket {
  attempts: number
  resetAt: number
}

export class MemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>()

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
  ) {}

  isAllowed(key: string): boolean {
    const now = Date.now()
    const current = this.buckets.get(key)
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { attempts: 1, resetAt: now + this.windowMs })
      return true
    }
    if (current.attempts >= this.maxAttempts) return false
    current.attempts += 1
    return true
  }

  clear(key: string): void {
    this.buckets.delete(key)
  }
}
