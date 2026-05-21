import { randomUUID } from "node:crypto";
import { resolveSnapshotAnchor } from "../snapshot/frozen.js";
const VALID_AGENT_REVIEW_TAGS = new Set([
    "spec",
    "standards",
    "bug"
]);
export class AgentReviewCoordinator {
    maxComments;
    maxBodyLength;
    ttlMs;
    now;
    pending;
    constructor(options = {}) {
        this.maxComments = options.maxComments ?? 50;
        this.maxBodyLength = options.maxBodyLength ?? 4000;
        this.ttlMs = options.ttlMs ?? 2 * 60 * 1000;
        this.now = options.now ?? Date.now;
    }
    start(snapshot) {
        this.expireIfNeeded();
        if (this.pending) {
            throw new Error("An agent pre-review is already pending.");
        }
        let submitted = [];
        let resolveSubmitted;
        const submittedPromise = new Promise((resolve) => {
            resolveSubmitted = resolve;
        });
        const pending = {
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
    submit(payload) {
        this.expireIfNeeded();
        const pending = this.pending;
        if (!pending || pending.reviewId !== payload.reviewId) {
            throw new Error("No pending agent review matches the submitted reviewId.");
        }
        if (payload.comments.length > this.maxComments) {
            throw new Error(`Too many comments. Maximum is ${this.maxComments}.`);
        }
        const byAnchor = new Map();
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
                throw new Error(`Comment body is too long. Maximum is ${this.maxBodyLength} characters.`);
            }
            const tags = normalizeAgentReviewTags(comment.tags);
            byAnchor.set(comment.anchorId, {
                anchorId: comment.anchorId,
                body,
                ...(tags.length > 0 ? { tags } : {})
            });
        }
        const accepted = [...byAnchor.values()];
        pending.setComments(accepted);
        this.pending = undefined;
        return { accepted: accepted.length };
    }
    current() {
        this.expireIfNeeded();
        return this.pending;
    }
    cancel() {
        this.pending = undefined;
    }
    expireIfNeeded() {
        if (this.pending && this.now() >= this.pending.expiresAt) {
            this.pending = undefined;
        }
    }
}
export function agentCommentsToSeedDrafts(comments) {
    return comments.map((comment) => ({
        anchorId: comment.anchorId,
        body: comment.body,
        source: "agent",
        ...(comment.tags && comment.tags.length > 0 ? { tags: comment.tags } : {})
    }));
}
function normalizeAgentReviewTags(tags) {
    if (tags == null)
        return [];
    if (!Array.isArray(tags)) {
        throw new Error("Agent review tags must be an array.");
    }
    const normalized = [];
    for (const tag of tags) {
        if (!VALID_AGENT_REVIEW_TAGS.has(tag)) {
            throw new Error(`Unknown agent review tag: ${String(tag)}.`);
        }
        if (!normalized.includes(tag)) {
            normalized.push(tag);
        }
    }
    return normalized;
}
