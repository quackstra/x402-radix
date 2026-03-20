import { ReplayStore } from "@x402/radix-server";

interface ReplayEntry {
  hash: string;
  expiresAt: number;
}

/**
 * In-memory replay store with TTL-based expiration.
 * Per canonical spec: retention = maxTimeoutSeconds + 300 seconds.
 */
export class InMemoryReplayStore implements ReplayStore {
  private entries: Map<string, ReplayEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  isReplay(hash: string): boolean {
    const entry = this.entries.get(hash);
    if (!entry) return false;
    if (Date.now() / 1000 > entry.expiresAt) {
      this.entries.delete(hash);
      return false;
    }
    return true;
  }

  record(hash: string, ttlSeconds: number): void {
    this.entries.set(hash, {
      hash,
      expiresAt: Date.now() / 1000 + ttlSeconds,
    });
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now() / 1000;
    for (const [key, entry] of this.entries) {
      if (now > entry.expiresAt) this.entries.delete(key);
    }
  }
}
