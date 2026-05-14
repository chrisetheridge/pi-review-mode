import { resolveSnapshotAnchor } from "../snapshot/frozen.js";
import type { ReviewSnapshot } from "../snapshot/types.js";
import type { ReviewDraft, ReviewDraftSource } from "./draft.types.js";

export class InProcessReviewSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InProcessReviewSessionError";
  }
}

export interface SeedReviewDraftInput {
  readonly anchorId: string;
  readonly body: string;
  readonly source: ReviewDraftSource;
}

export interface InProcessReviewSessionOptions {
  readonly now?: () => number;
  readonly seedDrafts?: readonly SeedReviewDraftInput[];
}

export class InProcessReviewSession {
  readonly snapshot: ReviewSnapshot;
  private readonly now: () => number;
  private readonly drafts = new Map<string, ReviewDraft>();
  private closed = false;
  private submitted = false;

  constructor(
    snapshot: ReviewSnapshot,
    options: InProcessReviewSessionOptions = {}
  ) {
    this.snapshot = snapshot;
    this.now = options.now ?? Date.now;
    for (const seed of options.seedDrafts ?? []) {
      this.seedDraft(seed);
    }
  }

  listDrafts(): ReviewDraft[] {
    if (this.closed) return [];
    return [...this.drafts.values()];
  }

  saveDraft(anchorId: string, body: string): ReviewDraft {
    this.assertUsable();
    const anchor = resolveSnapshotAnchor(this.snapshot, anchorId);
    if (!anchor) {
      throw new InProcessReviewSessionError("Unknown review anchor.");
    }
    const trimmed = body.trim();
    if (!trimmed) {
      throw new InProcessReviewSessionError("Comment body is required.");
    }
    const existing = this.drafts.get(anchorId);
    const draft: ReviewDraft = {
      anchor,
      body: trimmed,
      updatedAt: new Date(this.now()).toISOString(),
      source: existing?.source ?? "user"
    };
    this.drafts.set(anchorId, draft);
    return draft;
  }

  deleteDraft(anchorId: string): void {
    this.assertUsable();
    this.drafts.delete(anchorId);
  }

  submit(): ReviewDraft[] {
    this.assertUsable();
    if (this.drafts.size === 0) {
      throw new InProcessReviewSessionError(
        "Save at least one comment before submitting."
      );
    }
    const submittedDrafts = [...this.drafts.values()];
    this.submitted = true;
    this.finish();
    return submittedDrafts;
  }

  close(): void {
    if (!this.closed) {
      this.finish();
    }
  }

  isClosed(): boolean {
    return this.closed;
  }

  isSubmitted(): boolean {
    return this.submitted;
  }

  private seedDraft(seed: SeedReviewDraftInput): void {
    const anchor = resolveSnapshotAnchor(this.snapshot, seed.anchorId);
    if (!anchor) return;
    const body = seed.body.trim();
    if (!body) return;
    this.drafts.set(seed.anchorId, {
      anchor,
      body,
      updatedAt: new Date(this.now()).toISOString(),
      source: seed.source
    });
  }

  private assertUsable(): void {
    if (this.closed) {
      throw new InProcessReviewSessionError("Review session is closed.");
    }
  }

  private finish(): void {
    this.closed = true;
    this.drafts.clear();
  }
}
