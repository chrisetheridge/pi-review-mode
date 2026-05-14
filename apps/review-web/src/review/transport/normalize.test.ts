import { describe, expect, it } from "vitest";
import {
  normalizeDraftForTest,
  normalizeReviewSnapshotForTransport,
  normalizeSavedCommentForTransport,
  normalizeSavedCommentsForTransport
} from "./normalize";

describe("transport normalization", () => {
  it("normalizes a direct snapshot payload", () => {
    expect(
      normalizeReviewSnapshotForTransport({
        id: "s1",
        scope: { label: "Working tree" },
        stats: { filesChanged: 1, additions: 2, deletions: 3 },
        files: [
          {
            path: "file.txt",
            status: "modified",
            additions: 2,
            deletions: 3,
            binary: false,
            anchor: { id: "file:file.txt", path: "file.txt", side: "file" },
            hunks: []
          }
        ]
      })
    ).toMatchObject({
      id: "s1",
      title: "Working tree",
      stats: { filesChanged: 1, additions: 2, deletions: 3 },
      files: [
        {
          path: "file.txt",
          fileAnchor: {
            id: "file:file.txt",
            filePath: "file.txt",
            side: "file"
          }
        }
      ]
    });
  });

  it("normalizes direct draft arrays and single drafts", () => {
    const draft = {
      anchor: { id: "a1", path: "file.txt", side: "file" },
      body: "note",
      updatedAt: "2026-05-14T00:00:00.000Z",
      source: "agent"
    };

    expect(normalizeSavedCommentForTransport(draft)).toMatchObject({
      id: "a1",
      anchorId: "a1",
      filePath: "file.txt",
      body: "note",
      source: "agent"
    });
    expect(normalizeSavedCommentsForTransport([draft])).toHaveLength(1);
  });
});

describe("normalizeDraftForTest", () => {
  it("normalizes draft source from bridge payloads", () => {
    expect(
      normalizeDraftForTest({
        draft: {
          anchor: { id: "file:file.txt", path: "file.txt" },
          body: "comment",
          source: "agent"
        }
      }).source
    ).toBe("agent");

    expect(
      normalizeDraftForTest({
        draft: {
          anchor: { id: "file:file.txt", path: "file.txt" },
          body: "comment",
          source: "bogus"
        }
      }).source
    ).toBe("user");
  });
});
