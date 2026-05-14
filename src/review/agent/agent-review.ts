import { randomUUID } from "node:crypto";
import { resolveSnapshotAnchor } from "./frozen-snapshot.js";
import type { ReviewDraftSource, ReviewSnapshot } from "./types.js";

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

interface MutablePendingAgentReview extends PendingAgentReview {
  setComments(comments: SubmittedAgentReviewComment[]): void;
}

export interface AgentReviewCoordinatorOptions {
  readonly maxComments?: number;
  readonly maxBodyLength?: number;
  readonly ttlMs?: number;
  readonly now?: () => number;
}

export class AgentReviewCoordinator {
  private readonly maxComments: number;
  private readonly maxBodyLength: number;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private pending?: MutablePendingAgentReview;

  constructor(options: AgentReviewCoordinatorOptions = {}) {
    this.maxComments = options.maxComments ?? 50;
    this.maxBodyLength = options.maxBodyLength ?? 4000;
    this.ttlMs = options.ttlMs ?? 2 * 60 * 1000;
    this.now = options.now ?? Date.now;
  }

  start(snapshot: ReviewSnapshot): PendingAgentReview {
    this.expireIfNeeded();
    if (this.pending) {
      throw new Error("An agent pre-review is already pending.");
    }
    let submitted: SubmittedAgentReviewComment[] = [];
    let resolveSubmitted!: (comments: SubmittedAgentReviewComment[]) => void;
    const submittedPromise = new Promise<SubmittedAgentReviewComment[]>(
      (resolve) => {
        resolveSubmitted = resolve;
      }
    );
    const pending: MutablePendingAgentReview = {
      reviewId: randomUUID(),
      snapshot,
      expiresAt: this.now() + this.ttlMs,
      submitted: submittedPromise,
      comments: () => submitted,
      setComments: (comments) => {
        submitted = comments;
        resolveSubmitted(comments);
      }
    };
    this.pending = pending;
    return pending;
  }

  submit(payload: AgentReviewSubmitPayload): AgentReviewSubmitResult {
    this.expireIfNeeded();
    const pending = this.pending;
    if (!pending || pending.reviewId !== payload.reviewId) {
      throw new Error(
        "No pending agent review matches the submitted reviewId."
      );
    }

    if (payload.comments.length > this.maxComments) {
      throw new Error(`Too many comments. Maximum is ${this.maxComments}.`);
    }

    const byAnchor = new Map<string, SubmittedAgentReviewComment>();
    for (const comment of payload.comments) {
      const anchor = resolveSnapshotAnchor(pending.snapshot, comment.anchorId);
      if (!anchor) {
        throw new Error(`Unknown review anchor: ${comment.anchorId}.`);
      }
      const body = comment.body.trim();
      if (!body) {
        throw new Error("Comment body is required.");
      }
      if (body.length > this.maxBodyLength) {
        throw new Error(
          `Comment body is too long. Maximum is ${this.maxBodyLength} characters.`
        );
      }
      byAnchor.set(comment.anchorId, { anchorId: comment.anchorId, body });
    }

    const accepted = [...byAnchor.values()];
    pending.setComments(accepted);
    this.pending = undefined;
    return { accepted: accepted.length };
  }

  current(): PendingAgentReview | undefined {
    this.expireIfNeeded();
    return this.pending;
  }

  cancel(): void {
    this.pending = undefined;
  }

  private expireIfNeeded(): void {
    if (this.pending && this.now() >= this.pending.expiresAt) {
      this.pending = undefined;
    }
  }
}

export function agentCommentsToSeedDrafts(
  comments: readonly SubmittedAgentReviewComment[]
): SeedReviewDraft[] {
  return comments.map((comment) => ({
    anchorId: comment.anchorId,
    body: comment.body,
    source: "agent"
  }));
}
