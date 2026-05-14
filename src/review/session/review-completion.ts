import { resolveSnapshotAnchor } from "./frozen-snapshot.js";
import { buildReviewPrompt } from "./review-prompt-builder.js";
import type { ReviewDraft, ReviewSnapshot } from "./types.js";

export interface ReviewCompletionResult {
  readonly prompt: string;
  readonly closed: false;
}

export function completeReview(
  snapshot: ReviewSnapshot,
  drafts: readonly ReviewDraft[]
): ReviewCompletionResult {
  for (const draft of drafts) {
    if (!resolveSnapshotAnchor(snapshot, draft.anchor.id)) {
      throw new Error("Unknown review anchor.");
    }
  }

  return {
    prompt: buildReviewPrompt(snapshot, drafts),
    closed: false
  };
}
