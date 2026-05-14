import { buildReviewPrompt } from "../prompt/build.js";
import { resolveSnapshotAnchor } from "../snapshot/frozen.js";
import type { ReviewSnapshot } from "../snapshot/types.js";
import type { ReviewDraft } from "./draft.types.js";

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
