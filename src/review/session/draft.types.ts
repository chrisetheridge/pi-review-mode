import type { ReviewAnchor } from "../snapshot/types.js";

export type ReviewDraftSource = "user" | "agent";

export interface ReviewDraft {
  readonly anchor: ReviewAnchor;
  readonly body: string;
  readonly updatedAt: string;
  readonly source?: ReviewDraftSource;
}

export interface ReviewSubmitResult {
  readonly prompt: string;
}
