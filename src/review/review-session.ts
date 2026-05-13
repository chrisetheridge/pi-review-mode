import { randomBytes } from "node:crypto";
import { resolveSnapshotAnchor } from "./frozen-snapshot.js";
import type { ReviewDraft, ReviewSnapshot } from "./types.js";

export class ReviewSessionError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ReviewSessionError";
    this.status = status;
  }
}

export interface ReviewSessionOptions {
  readonly ttlMs?: number;
  readonly now?: () => number;
  readonly onClose?: (reason: ReviewSessionCloseReason) => void;
}

export type ReviewSessionCloseReason =
  | "submit"
  | "close"
  | "expiry"
  | "shutdown";

export class ReviewSession {
  readonly token: string;
  readonly snapshot: ReviewSnapshot;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly drafts = new Map<string, ReviewDraft>();
  private readonly onClose?: (reason: ReviewSessionCloseReason) => void;
  private expiresAt: number;
  private closed = false;
  private submitted = false;

  constructor(snapshot: ReviewSnapshot, options: ReviewSessionOptions = {}) {
    this.snapshot = snapshot;
    this.token = randomBytes(32).toString("base64url");
    this.ttlMs = options.ttlMs ?? 30 * 60 * 1000;
    this.now = options.now ?? Date.now;
    this.onClose = options.onClose;
    this.expiresAt = this.now() + this.ttlMs;
  }

  isAuthorized(token: string | undefined): boolean {
    return token === this.token;
  }

  listDrafts(token: string): ReviewDraft[] {
    this.assertUsable(token);
    return [...this.drafts.values()];
  }

  saveDraft(token: string, anchorId: string, body: string): ReviewDraft {
    this.assertUsable(token);
    const anchor = resolveSnapshotAnchor(this.snapshot, anchorId);
    if (!anchor) {
      throw new ReviewSessionError("Unknown review anchor.", 404);
    }
    const trimmed = body.trim();
    if (!trimmed) {
      throw new ReviewSessionError("Comment body is required.");
    }
    const draft = {
      anchor,
      body: trimmed,
      updatedAt: new Date(this.now()).toISOString()
    };
    this.drafts.set(anchorId, draft);
    return draft;
  }

  deleteDraft(token: string, anchorId: string): void {
    this.assertUsable(token);
    this.drafts.delete(anchorId);
  }

  heartbeat(token: string): { expiresAt: string } {
    this.assertUsable(token);
    this.expiresAt = this.now() + this.ttlMs;
    return { expiresAt: new Date(this.expiresAt).toISOString() };
  }

  submit(token: string): ReviewDraft[] {
    this.assertUsable(token);
    if (this.drafts.size === 0) {
      throw new ReviewSessionError(
        "Save at least one comment before submitting."
      );
    }
    const submittedDrafts = [...this.drafts.values()];
    this.submitted = true;
    this.finish("submit");
    return submittedDrafts;
  }

  close(token: string): void {
    this.assertUsable(token);
    this.finish("close");
  }

  shutdown(): void {
    if (!this.closed) {
      this.finish("shutdown");
    }
  }

  expireIfNeeded(): boolean {
    if (!this.closed && this.now() >= this.expiresAt) {
      this.finish("expiry");
      return true;
    }
    return false;
  }

  isClosed(): boolean {
    return this.closed;
  }

  isSubmitted(): boolean {
    return this.submitted;
  }

  private assertUsable(token: string): void {
    if (!this.isAuthorized(token)) {
      throw new ReviewSessionError("Unauthorized.", 401);
    }
    if (this.expireIfNeeded()) {
      throw new ReviewSessionError("Review session expired.", 410);
    }
    if (this.closed) {
      throw new ReviewSessionError("Review session is closed.", 410);
    }
  }

  private finish(reason: ReviewSessionCloseReason): void {
    this.closed = true;
    this.drafts.clear();
    this.onClose?.(reason);
  }
}
