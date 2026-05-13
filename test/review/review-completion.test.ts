import { describe, expect, it } from "vitest";
import { parseReviewDiff } from "../../src/review/diff-parser.js";
import { completeReview } from "../../src/review/review-completion.js";
import type { ReviewDraft, ReviewSnapshot } from "../../src/review/types.js";

describe("completeReview", () => {
  it("turns frozen snapshot drafts into a generated prompt completion result", () => {
    const snapshot = snapshotFromDiff(`diff --git a/file.txt b/file.txt
--- a/file.txt
+++ b/file.txt
@@ -1 +1,2 @@
 keep
+add
`);
    const drafts: ReviewDraft[] = [
      {
        anchor: snapshot.files[0].hunks[0].rows[1].anchor,
        body: "Adjust this line.",
        updatedAt: "now"
      }
    ];

    const result = completeReview(snapshot, drafts);

    expect(result.closed).toBe(false);
    expect(result.prompt).toContain("Adjust this line.");
    expect(result.prompt).toContain("Snapshot: snapshot");
  });

  it("rejects drafts whose anchors are not in the frozen snapshot", () => {
    const snapshot = snapshotFromDiff(`diff --git a/file.txt b/file.txt
--- a/file.txt
+++ b/file.txt
@@ -1 +1,2 @@
 keep
+add
`);

    expect(() =>
      completeReview(snapshot, [
        {
          anchor: { id: "unknown", path: "file.txt", side: "file" },
          body: "Stale comment",
          updatedAt: "now"
        }
      ])
    ).toThrow("Unknown review anchor");
  });
});

function snapshotFromDiff(diff: string): ReviewSnapshot {
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
