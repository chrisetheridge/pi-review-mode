import { describe, expect, it } from "vitest";
import type { ReviewSnapshot } from "../../src/review/index.js";
import { buildAgentReviewPrompt } from "../../src/review/prompt/agent.js";
import { parseReviewDiff } from "../../src/review/snapshot/parse-diff.js";

describe("buildAgentReviewPrompt", () => {
  it("includes scope metadata, safety instructions, tool instructions, and anchor IDs", () => {
    const snapshot = snapshotFromDiff(`diff --git a/file.txt b/file.txt
--- a/file.txt
+++ b/file.txt
@@ -1 +1,2 @@
 keep
+add
`);

    const prompt = buildAgentReviewPrompt(snapshot, "review-123");

    expect(prompt).toContain("review-123");
    expect(prompt).toContain("Scope: Working tree changes");
    expect(prompt).toContain("Snapshot: snapshot");
    expect(prompt).toContain("frozen Git diff snapshot");
    expect(prompt).toContain("Do not edit files");
    expect(prompt).toContain("submit_review_mode_comments");
    expect(prompt).toContain("Valid tags: `spec`, `standards`, `bug`");
    expect(prompt).toContain("Tags are optional");
    expect(prompt).toContain("A comment may include multiple tags");
    expect(prompt).toContain("Do not invent requirements");
    expect(prompt).toContain('"tags": ["spec", "bug"]');
    expect(prompt).toContain(snapshot.files[0].anchor.id);
    expect(prompt).toContain(snapshot.files[0].hunks[0].rows[1].anchor.id);
    expect(prompt).toContain("anchorId");
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
