import { describe, expect, it, vi } from "vitest";
import { parseReviewDiff } from "../../src/review/diff-parser.js";
import { ReviewSession } from "../../src/review/review-session.js";
import type { ReviewSnapshot } from "../../src/review/types.js";

describe("ReviewSession", () => {
  it("requires authorization and stores one draft per anchor", () => {
    const session = new ReviewSession(snapshot());
    const anchor = session.snapshot.files[0].anchor;

    expect(() => session.listDrafts("wrong")).toThrow("Unauthorized");
    session.saveDraft(session.token, anchor.id, "first");
    session.saveDraft(session.token, anchor.id, "second");

    expect(session.listDrafts(session.token)).toHaveLength(1);
    expect(session.listDrafts(session.token)[0].body).toBe("second");
  });

  it("rejects submit with zero saved comments", () => {
    const session = new ReviewSession(snapshot());

    expect(() => session.submit(session.token)).toThrow(
      "Save at least one comment"
    );
  });

  it("discards drafts after submit and close", () => {
    const submitted = new ReviewSession(snapshot());
    submitted.saveDraft(
      submitted.token,
      submitted.snapshot.files[0].anchor.id,
      "comment"
    );
    const drafts = submitted.submit(submitted.token);

    expect(drafts).toHaveLength(1);
    expect(submitted.isClosed()).toBe(true);
    expect(() => submitted.listDrafts(submitted.token)).toThrow("closed");

    const closed = new ReviewSession(snapshot());
    closed.saveDraft(
      closed.token,
      closed.snapshot.files[0].anchor.id,
      "comment"
    );
    closed.close(closed.token);
    expect(() => closed.listDrafts(closed.token)).toThrow("closed");
  });

  it("extends heartbeat and expires sessions", () => {
    let now = 1000;
    const onClose = vi.fn();
    const session = new ReviewSession(snapshot(), {
      ttlMs: 100,
      now: () => now,
      onClose
    });

    now = 1050;
    session.heartbeat(session.token);
    now = 1120;
    expect(session.expireIfNeeded()).toBe(false);
    now = 1160;
    expect(session.expireIfNeeded()).toBe(true);
    expect(onClose).toHaveBeenCalledWith("expiry");
  });
});

function snapshot(): ReviewSnapshot {
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
    stats: { filesChanged: 1, additions: 1, deletions: 0, changedLines: 1 },
    warnings: []
  };
}
