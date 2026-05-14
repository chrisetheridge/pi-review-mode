import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGlimpseReviewTransport } from "./glimpse-transport";
import { ReviewTransportError } from "./review-transport";

function installGlimpse(send: (message: unknown) => void) {
  window.glimpse = { send };
}

describe("createGlimpseReviewTransport", () => {
  beforeEach(() => {
    delete window.glimpse;
    delete window.__PI_REVIEW_RECEIVE__;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends a ready request and resolves load from host response", async () => {
    const sent: unknown[] = [];
    installGlimpse((message) => sent.push(message));
    const transport = createGlimpseReviewTransport();

    const promise = transport.load();
    const request = sent[0] as { requestId: string; type: string };
    expect(request.type).toBe("review:ready");

    window.__PI_REVIEW_RECEIVE__?.({
      type: "review:response",
      requestId: request.requestId,
      ok: true,
      data: {
        snapshot: {
          id: "s1",
          scope: { label: "Working tree" },
          stats: { filesChanged: 0, additions: 0, deletions: 0 },
          files: []
        },
        drafts: []
      }
    });

    await expect(promise).resolves.toEqual({
      snapshot: {
        id: "s1",
        title: "Working tree",
        baseRef: undefined,
        headRef: undefined,
        stats: { filesChanged: 0, additions: 0, deletions: 0 },
        files: []
      },
      drafts: []
    });
  });

  it("rejects host errors", async () => {
    const sent: unknown[] = [];
    installGlimpse((message) => sent.push(message));
    const transport = createGlimpseReviewTransport();

    const promise = transport.submit();
    const request = sent[0] as { requestId: string };
    window.__PI_REVIEW_RECEIVE__?.({
      type: "review:response",
      requestId: request.requestId,
      ok: false,
      error: "Save at least one comment before submitting."
    });

    await expect(promise).rejects.toEqual(
      new ReviewTransportError("Save at least one comment before submitting.")
    );
  });

  it("fails when Glimpse is unavailable", async () => {
    const transport = createGlimpseReviewTransport();

    await expect(transport.load()).rejects.toEqual(
      new ReviewTransportError("Native review bridge is unavailable.")
    );
  });

  it("times out unanswered requests", async () => {
    vi.useFakeTimers();
    installGlimpse(() => undefined);
    const transport = createGlimpseReviewTransport({ timeoutMs: 25 });

    const promise = transport.close();
    const expectation = expect(promise).rejects.toEqual(
      new ReviewTransportError("Native review bridge request timed out.")
    );
    await vi.advanceTimersByTimeAsync(25);

    await expectation;
  });
});
