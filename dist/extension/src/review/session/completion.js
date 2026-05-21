import { buildReviewPrompt } from "../prompt/build.js";
import { resolveSnapshotAnchor } from "../snapshot/frozen.js";
export function completeReview(snapshot, drafts) {
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
