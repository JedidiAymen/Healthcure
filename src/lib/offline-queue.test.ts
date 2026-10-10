import { describe, expect, it, vi } from "vitest";
import { drainQueue, enqueueSubmit, isNetworkError, loadDraft, memoryStore, queuedSubmits, saveDraft } from "./offline-queue";

describe("offline drafts", () => {
  it("survive and can be reloaded per attempt", async () => {
    const store = memoryStore();
    await saveDraft(store, "a1", { q1: "partial answer" });
    expect((await loadDraft(store, "a1"))?.answers).toEqual({ q1: "partial answer" });
    expect(await loadDraft(store, "a2")).toBeUndefined();
  });
});

describe("queued submits", () => {
  it("keep one entry per attempt with its original idempotency key", async () => {
    const store = memoryStore();
    await enqueueSubmit(store, { attemptId: "a1", revision: 2, idempotencyKey: "key-1" });
    await enqueueSubmit(store, { attemptId: "a1", revision: 3, idempotencyKey: "key-1" });
    const queue = await queuedSubmits(store);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ revision: 3, idempotencyKey: "key-1" });
  });

  it("replay in order, stop on a network error, and keep the rest", async () => {
    const store = memoryStore();
    await enqueueSubmit(store, { attemptId: "a1", revision: 1, idempotencyKey: "k1" });
    await enqueueSubmit(store, { attemptId: "a2", revision: 1, idempotencyKey: "k2" });
    await saveDraft(store, "a1", { q: "x" });
    const send = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const result = await drainQueue(store, send);
    expect(result).toMatchObject({ remaining: 1 });
    expect(result.sent.map(item => item.attemptId)).toEqual(["a1"]);
    expect(await loadDraft(store, "a1")).toBeUndefined();
    expect((await queuedSubmits(store)).map(item => item.attemptId)).toEqual(["a2"]);
  });

  it("drop items the server definitively refused", async () => {
    const store = memoryStore();
    await enqueueSubmit(store, { attemptId: "a1", revision: 1, idempotencyKey: "k1" });
    const result = await drainQueue(store, vi.fn().mockRejectedValue(new Error("This attempt has already been submitted")));
    expect(result.failed[0].error).toMatch(/already been submitted/);
    expect(await queuedSubmits(store)).toEqual([]);
  });
});

describe("isNetworkError", () => {
  it("treats dropped connections and a stopped API behind the proxy as offline", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new Error("API returned 502"))).toBe(true);
    expect(isNetworkError(new Error("Answer every question block before submitting"))).toBe(false);
  });
});
