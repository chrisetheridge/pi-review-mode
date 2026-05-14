import { describe, expect, it } from "vitest";
import type { ReviewSnapshot } from "../../src/review/index.js";
import {
  resolveSnapshotAnchor,
  snapshotFileForAnchor
} from "../../src/review/snapshot/frozen.js";
import { parseReviewDiff } from "../../src/review/snapshot/parse-diff.js";

describe("frozen snapshot helpers", () => {
  it("resolves file and line anchors from the frozen snapshot", () => {
    const snapshot = snapshotFromDiff(`diff --git a/file.txt b/file.txt
--- a/file.txt
+++ b/file.txt
@@ -1 +1,2 @@
 keep
+add
`);
    const file = snapshot.files[0];
    const row = file.hunks[0].rows[1];

    expect(resolveSnapshotAnchor(snapshot, file.anchor.id)).toEqual(
      file.anchor
    );
    expect(resolveSnapshotAnchor(snapshot, row.anchor.id)).toEqual(row.anchor);
    expect(snapshotFileForAnchor(snapshot, row.anchor)).toBe(file);
  });

  it("returns undefined for anchors outside the frozen snapshot", () => {
    const snapshot = snapshotFromDiff(`diff --git a/file.txt b/file.txt
--- a/file.txt
+++ b/file.txt
@@ -1 +1,2 @@
 keep
+add
`);

    expect(resolveSnapshotAnchor(snapshot, "missing-anchor")).toBeUndefined();
    expect(
      snapshotFileForAnchor(snapshot, {
        id: "missing-anchor",
        path: "other.txt"
      })
    ).toBeUndefined();
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
