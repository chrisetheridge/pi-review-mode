import { describe, expect, it } from "vitest";
import {
  AgentReviewCoordinator,
  type SubmittedAgentReviewComment
} from "../../src/review/agent-review.js";
import { parseReviewDiff } from "../../src/review/diff-parser.js";
import type { ReviewSnapshot } from "../../src/review/types.js";

describe("AgentReviewCoordinator", () => {
  it("accepts valid submitted comments and collapses duplicate anchors", () => {
    const snapshot = snapshotFromDiff();
    const coordinator = new AgentReviewCoordinator();
    const pending = coordinator.start(snapshot);
    const anchorId = snapshot.files[0].anchor.id;

    const result = coordinator.submit({
      reviewId: pending.reviewId,
      comments: [
        { anchorId, body: " first " },
        { anchorId, body: " second " }
      ]
    });

    expect(result.accepted).toBe(1);
    expect(pending.comments()).toEqual<SubmittedAgentReviewComment[]>([
      { anchorId, body: "second" }
    ]);
  });

  it("rejects unknown anchors, empty bodies, and mismatched review IDs", () => {
    const snapshot = snapshotFromDiff();
    const coordinator = new AgentReviewCoordinator();
    const pending = coordinator.start(snapshot);

    expect(() =>
      coordinator.submit({
        reviewId: "wrong",
        comments: []
      })
    ).toThrow("No pending agent review");

    expect(() =>
      coordinator.submit({
        reviewId: pending.reviewId,
        comments: [{ anchorId: "missing", body: "body" }]
      })
    ).toThrow("Unknown review anchor");

    expect(() =>
      coordinator.submit({
        reviewId: pending.reviewId,
        comments: [{ anchorId: snapshot.files[0].anchor.id, body: "   " }]
      })
    ).toThrow("Comment body is required");
  });

  it("caps comment count and body length", () => {
    const snapshot = snapshotFromDiff();
    const coordinator = new AgentReviewCoordinator({
      maxComments: 1,
      maxBodyLength: 5
    });
    const pending = coordinator.start(snapshot);

    expect(() =>
      coordinator.submit({
        reviewId: pending.reviewId,
        comments: [
          { anchorId: snapshot.files[0].anchor.id, body: "one" },
          {
            anchorId: snapshot.files[0].hunks[0].rows[0].anchor.id,
            body: "two"
          }
        ]
      })
    ).toThrow("Too many comments");

    expect(() =>
      coordinator.submit({
        reviewId: pending.reviewId,
        comments: [{ anchorId: snapshot.files[0].anchor.id, body: "123456" }]
      })
    ).toThrow("Comment body is too long");
  });

  it("allows only one pending review", () => {
    const coordinator = new AgentReviewCoordinator();
    coordinator.start(snapshotFromDiff());

    expect(() => coordinator.start(snapshotFromDiff())).toThrow(
      "An agent pre-review is already pending"
    );
  });
});

function snapshotFromDiff(): ReviewSnapshot {
  const diff = `diff --git a/file.txt b/file.txt
--- a/file.txt
+++ b/file.txt
@@ -1 +1,2 @@
 keep
+add
`;
  const files = parseReviewDiff(diff);
  return {
    id: "snapshot",
    createdAt: "2026-05-12T00:00:00.000Z",
    repoRoot: "/repo",
    scope: {
      kind: "working-tree",
      repoRoot: "/repo",
      label: "Working tree changes"
    },
    baseRef: "HEAD",
    headRef: "head",
    diff,
    files,
    stats: {
      filesChanged: files.length,
      additions: 1,
      deletions: 0,
      changedLines: 1
    },
    warnings: []
  };
}
