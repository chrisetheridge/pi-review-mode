import {
  normalizeReviewSnapshotForTransport,
  normalizeSavedCommentForTransport,
  normalizeSavedCommentsForTransport
} from "./api";
import type { ReviewTransport } from "./review-transport";
import { ReviewTransportError } from "./review-transport";
import type { SaveCommentRequest, SubmitResponse } from "./types";

interface PendingRequest {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timer: number;
}

interface GlimpseTransportOptions {
  readonly timeoutMs?: number;
}

let nextRequestId = 0;

export function createGlimpseReviewTransport(
  options: GlimpseTransportOptions = {}
): ReviewTransport {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const pending = new Map<string, PendingRequest>();

  window.__PI_REVIEW_RECEIVE__ = (message: unknown) => {
    const raw = message as {
      type?: string;
      requestId?: string;
      ok?: boolean;
      data?: unknown;
      error?: string;
    };
    if (raw.type !== "review:response" || !raw.requestId) return;
    const request = pending.get(raw.requestId);
    if (!request) return;
    pending.delete(raw.requestId);
    window.clearTimeout(request.timer);
    if (raw.ok) {
      request.resolve(raw.data);
    } else {
      request.reject(
        new ReviewTransportError(raw.error ?? "Native review request failed.")
      );
    }
  };

  function request<T>(
    type: string,
    payload: Record<string, unknown> = {}
  ): Promise<T> {
    if (!window.glimpse?.send) {
      return Promise.reject(
        new ReviewTransportError("Native review bridge is unavailable.")
      );
    }
    const requestId = `review-${++nextRequestId}`;
    const promise = new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        pending.delete(requestId);
        reject(
          new ReviewTransportError("Native review bridge request timed out.")
        );
      }, timeoutMs);
      pending.set(requestId, {
        resolve: (value) => resolve(value as T),
        reject,
        timer
      });
    });
    window.glimpse.send({ type, requestId, ...payload });
    return promise;
  }

  return {
    async load() {
      const data = await request<{ snapshot: unknown; drafts: unknown }>(
        "review:ready"
      );
      return {
        snapshot: normalizeReviewSnapshotForTransport(data.snapshot),
        drafts: normalizeSavedCommentsForTransport(data.drafts)
      };
    },
    async saveDraft(draft: SaveCommentRequest) {
      const data = await request<{ draft: unknown }>("review:save-draft", {
        anchorId: draft.anchor.id,
        body: draft.body
      });
      return normalizeSavedCommentForTransport(data.draft);
    },
    async deleteDraft(anchorId: string) {
      await request("review:delete-draft", { anchorId });
    },
    async close() {
      await request("review:cancel");
      window.glimpse?.close?.();
    },
    async submit() {
      return request<SubmitResponse>("review:submit");
    }
  };
}
