import { describe, expect, it } from "vitest";
import { parseReviewDiff } from "../../src/review/diff-parser.js";
import {
  InProcessReviewSession,
  InProcessReviewSessionError
} from "../../src/review/in-process-review-session.js";
import type { ReviewSnapshot } from "../../src/review/types.js";

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
    createdAt: "2026-05-14T00:00:00.000Z",
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

describe("InProcessReviewSession", () => {
  it("seeds valid drafts and ignores invalid seed anchors", () => {
    const reviewSnapshot = snapshot();
    const session = new InProcessReviewSession(reviewSnapshot, {
      now: () => 0,
      seedDrafts: [
        {
          anchorId: reviewSnapshot.files[0].anchor.id,
          body: " seeded note ",
          source: "agent"
        },
        { anchorId: "missing", body: "ignored", source: "agent" }
      ]
    });

    expect(session.listDrafts()).toEqual([
      {
        anchor: reviewSnapshot.files[0].anchor,
        body: "seeded note",
        updatedAt: "1970-01-01T00:00:00.000Z",
        source: "agent"
      }
    ]);
  });

  it("saves user drafts by anchor id and trims bodies", () => {
    const reviewSnapshot = snapshot();
    const session = new InProcessReviewSession(reviewSnapshot, {
      now: () => 1_000
    });
    const anchor = reviewSnapshot.files[0].hunks[0].rows[1].anchor;

    const draft = session.saveDraft(anchor.id, "  please fix this  ");

    expect(draft).toEqual({
      anchor,
      body: "please fix this",
      updatedAt: "1970-01-01T00:00:01.000Z",
      source: "user"
    });
    expect(session.listDrafts()).toEqual([draft]);
  });

  it("preserves seeded draft source when edited", () => {
    const reviewSnapshot = snapshot();
    const anchor = reviewSnapshot.files[0].anchor;
    const session = new InProcessReviewSession(reviewSnapshot, {
      now: () => 2_000,
      seedDrafts: [{ anchorId: anchor.id, body: "agent note", source: "agent" }]
    });

    expect(session.saveDraft(anchor.id, "updated").source).toBe("agent");
  });

  it("rejects unknown anchors and blank bodies", () => {
    const reviewSnapshot = snapshot();
    const session = new InProcessReviewSession(reviewSnapshot);

    expect(() => session.saveDraft("missing", "body")).toThrow(
      new InProcessReviewSessionError("Unknown review anchor.")
    );
    expect(() =>
      session.saveDraft(reviewSnapshot.files[0].anchor.id, "   ")
    ).toThrow(new InProcessReviewSessionError("Comment body is required."));
  });

  it("deletes drafts", () => {
    const reviewSnapshot = snapshot();
    const anchor = reviewSnapshot.files[0].anchor;
    const session = new InProcessReviewSession(reviewSnapshot);
    session.saveDraft(anchor.id, "note");

    session.deleteDraft(anchor.id);

    expect(session.listDrafts()).toEqual([]);
  });

  it("blocks submit with no drafts", () => {
    const session = new InProcessReviewSession(snapshot());

    expect(() => session.submit()).toThrow(
      new InProcessReviewSessionError(
        "Save at least one comment before submitting."
      )
    );
  });

  it("returns submitted drafts and closes", () => {
    const reviewSnapshot = snapshot();
    const anchor = reviewSnapshot.files[0].anchor;
    const session = new InProcessReviewSession(reviewSnapshot);
    const draft = session.saveDraft(anchor.id, "note");

    expect(session.submit()).toEqual([draft]);
    expect(session.isClosed()).toBe(true);
    expect(session.isSubmitted()).toBe(true);
    expect(session.listDrafts()).toEqual([]);
  });

  it("rejects operations after close", () => {
    const reviewSnapshot = snapshot();
    const session = new InProcessReviewSession(reviewSnapshot);
    session.close();

    expect(() =>
      session.saveDraft(reviewSnapshot.files[0].anchor.id, "note")
    ).toThrow(new InProcessReviewSessionError("Review session is closed."));
  });
});
