import { resolveSnapshotAnchor } from "../snapshot/frozen.js";
export class InProcessReviewSessionError extends Error {
    constructor(message) {
        super(message);
        this.name = "InProcessReviewSessionError";
    }
}
export class InProcessReviewSession {
    snapshot;
    now;
    drafts = new Map();
    closed = false;
    submitted = false;
    constructor(snapshot, options = {}) {
        this.snapshot = snapshot;
        this.now = options.now ?? Date.now;
        for (const seed of options.seedDrafts ?? []) {
            this.seedDraft(seed);
        }
    }
    listDrafts() {
        if (this.closed)
            return [];
        return [...this.drafts.values()];
    }
    saveDraft(anchorId, body) {
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
        const draft = {
            anchor,
            body: trimmed,
            updatedAt: new Date(this.now()).toISOString(),
            source: existing?.source ?? "user",
            ...(existing?.tags ? { tags: existing.tags } : {})
        };
        this.drafts.set(anchorId, draft);
        return draft;
    }
    deleteDraft(anchorId) {
        this.assertUsable();
        this.drafts.delete(anchorId);
    }
    submit() {
        this.assertUsable();
        if (this.drafts.size === 0) {
            throw new InProcessReviewSessionError("Save at least one comment before submitting.");
        }
        const submittedDrafts = [...this.drafts.values()];
        this.submitted = true;
        this.finish();
        return submittedDrafts;
    }
    close() {
        if (!this.closed) {
            this.finish();
        }
    }
    isClosed() {
        return this.closed;
    }
    isSubmitted() {
        return this.submitted;
    }
    seedDraft(seed) {
        const anchor = resolveSnapshotAnchor(this.snapshot, seed.anchorId);
        if (!anchor)
            return;
        const body = seed.body.trim();
        if (!body)
            return;
        this.drafts.set(seed.anchorId, {
            anchor,
            body,
            updatedAt: new Date(this.now()).toISOString(),
            source: seed.source,
            ...(seed.tags ? { tags: seed.tags } : {})
        });
    }
    assertUsable() {
        if (this.closed) {
            throw new InProcessReviewSessionError("Review session is closed.");
        }
    }
    finish() {
        this.closed = true;
        this.drafts.clear();
    }
}
