import { describe, expect, it } from "vitest";
import type { ReviewDraft, ReviewSnapshot } from "../../src/review/index.js";
import { buildReviewPrompt } from "../../src/review/prompt/build.js";
import { parseReviewDiff } from "../../src/review/snapshot/parse-diff.js";

describe("buildReviewPrompt", () => {
  it("groups comments by file order with file comments before line comments", () => {
    const snapshot = snapshotFromDiff(`diff --git a/one.txt b/one.txt
--- a/one.txt
+++ b/one.txt
@@ -1 +1,2 @@
 keep
+add one
diff --git a/two.txt b/two.txt
--- a/two.txt
+++ b/two.txt
@@ -1 +1,2 @@
 keep
+add two
`);
    const one = snapshot.files[0];
    const two = snapshot.files[1];
    const drafts: ReviewDraft[] = [
      {
        anchor: two.hunks[0].rows[1].anchor,
        body: "line two",
        updatedAt: "now"
      },
      {
        anchor: one.hunks[0].rows[1].anchor,
        body: "line one",
        updatedAt: "now"
      },
      {
        anchor: one.anchor,
        body: "file one",
        updatedAt: "now",
        source: "agent",
        tags: ["spec", "standards", "bug"]
      }
    ];

    const prompt = buildReviewPrompt(snapshot, drafts);

    expect(prompt.indexOf("### one.txt")).toBeLessThan(
      prompt.indexOf("### two.txt")
    );
    expect(prompt.indexOf("File comment: file one")).toBeLessThan(
      prompt.indexOf("line one")
    );
    expect(prompt).toContain("frozen Git diff snapshot");
    expect(prompt).toContain("```diff");
    expect(prompt).toContain("+add one");
    expect(prompt).not.toContain("Agent");
    expect(prompt).not.toContain("source");
    expect(prompt).not.toContain("standards");
    expect(prompt).not.toContain("bug");
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
      additions: 2,
      deletions: 0,
      changedLines: 2
    },
    warnings: []
  };
}
