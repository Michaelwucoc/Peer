import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rateLimit } from "./rate-limit";

/** Every case shares the module's process-wide store (and the capped table below). */
function clearStore(): void {
  (
    globalThis as unknown as { rateLimitStore?: Map<string, unknown> }
  ).rateLimitStore?.clear();
}

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    clearStore();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to max hits, then blocks", () => {
    const opts = { max: 3, windowMs: 1000 };
    expect(rateLimit("a", opts).ok).toBe(true);
    expect(rateLimit("a", opts).ok).toBe(true);
    expect(rateLimit("a", opts).ok).toBe(true);
    const blocked = rateLimit("a", opts);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("recovers once the window passes", () => {
    const opts = { max: 2, windowMs: 1000 };
    rateLimit("b", opts);
    rateLimit("b", opts);
    expect(rateLimit("b", opts).ok).toBe(false);
    vi.setSystemTime(1001);
    expect(rateLimit("b", opts).ok).toBe(true);
  });

  it("does not count blocked hits (they can't push the window forward)", () => {
    const opts = { max: 1, windowMs: 1000 };
    expect(rateLimit("c", opts).ok).toBe(true); // counted at t=0
    vi.setSystemTime(500);
    expect(rateLimit("c", opts).ok).toBe(false); // blocked, not counted
    vi.setSystemTime(1001); // the t=0 hit has aged out
    expect(rateLimit("c", opts).ok).toBe(true);
  });

  it("tracks keys independently", () => {
    const opts = { max: 1, windowMs: 1000 };
    expect(rateLimit("k1", opts).ok).toBe(true);
    expect(rateLimit("k2", opts).ok).toBe(true);
    expect(rateLimit("k1", opts).ok).toBe(false);
  });

  it("still admits a fresh key when rotating identities have filled the table", () => {
    const opts = { max: 1, windowMs: 60_000 };
    // A bucket in the namespace the filler will use, and an unrelated tenant's bucket.
    expect(rateLimit("signin:own", opts).ok).toBe(true);
    expect(rateLimit("pwreset:old", opts).ok).toBe(true);
    vi.setSystemTime(100);
    for (let i = 0; i < 10_000; i++) rateLimit(`signin:id:${i}`, opts);

    // A first-time signer is not told "too many attempts" because someone else filled the table.
    expect(rateLimit("signin:fresh", opts).ok).toBe(true);
    // The full-table pressure stays in the filler's namespace, so another feature keeps its count.
    expect(rateLimit("pwreset:old", opts).ok).toBe(false);
    // A key with no bucket of its own is admitted too (the least recently seen bucket gives way).
    expect(rateLimit("dm:fresh", opts).ok).toBe(true);
  });
});
