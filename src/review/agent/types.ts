import type { ReviewDraftSource } from "../session/draft.types.js";
import type { ReviewSnapshot } from "../snapshot/types.js";

export interface SubmittedAgentReviewComment {
  readonly anchorId: string;
  readonly body: string;
}

export interface SeedReviewDraft {
  readonly anchorId: string;
  readonly body: string;
  readonly source: ReviewDraftSource;
}

export interface AgentReviewSubmitPayload {
  readonly reviewId: string;
  readonly comments: readonly SubmittedAgentReviewComment[];
}

export interface AgentReviewSubmitResult {
  readonly accepted: number;
}

export interface PendingAgentReview {
  readonly reviewId: string;
  readonly snapshot: ReviewSnapshot;
  readonly expiresAt: number;
  readonly submitted: Promise<SubmittedAgentReviewComment[]>;
  comments(): SubmittedAgentReviewComment[];
}

export interface AgentReviewCoordinatorOptions {
  readonly maxComments?: number;
  readonly maxBodyLength?: number;
  readonly ttlMs?: number;
  readonly now?: () => number;
}

export interface MutablePendingAgentReview extends PendingAgentReview {
  setComments(comments: SubmittedAgentReviewComment[]): void;
}
