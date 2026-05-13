import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReviewApi } from "./api";
import type { ReviewSnapshot } from "./types";
import { useReviewSurfaceState } from "./use-review-surface-state";

const snapshot: ReviewSnapshot = {
  id: "snapshot-1",
  title: "Working tree review",
  stats: { filesChanged: 1, additions: 1, deletions: 0 },
  files: [
    {
      path: "src/app.ts",
      status: "modified",
      additions: 1,
      deletions: 0,
      binary: false,
      fileAnchor: {
        id: "file-src/app.ts",
        filePath: "src/app.ts",
        side: "file"
      },
      hunks: []
    }
  ]
};

function makeApi(overrides: Partial<ReviewApi> = {}): ReviewApi {
  return {
    getSnapshot: vi.fn().mockResolvedValue(snapshot),
    getDrafts: vi.fn().mockResolvedValue([]),
    saveDraft: vi.fn(async ({ anchor, body }) => ({
      id: `comment-${anchor.id}`,
      anchorId: anchor.id,
      filePath: anchor.filePath,
      body
    })),
    deleteDraft: vi.fn().mockResolvedValue(undefined),
    heartbeat: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    submit: vi.fn().mockResolvedValue({ prompt: "Prompt text" }),
    ...overrides
  };
}

describe("useReviewSurfaceState", () => {
  it("loads the snapshot and draft state for the review surface", async () => {
    const api = makeApi();

    const { result } = renderHook(() =>
      useReviewSurfaceState({ api, token: "test-token" })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.snapshot?.id).toBe("snapshot-1");
    expect(result.current.selectedPath).toBe("src/app.ts");
    expect(result.current.canSubmit).toBe(false);
  });

  it("blocks submit while an active editor exists", async () => {
    const api = makeApi({
      getDrafts: vi.fn().mockResolvedValue([
        {
          id: "comment-file",
          anchorId: "file-src/app.ts",
          filePath: "src/app.ts",
          body: "Saved"
        }
      ])
    });

    const { result } = renderHook(() =>
      useReviewSurfaceState({ api, token: "test-token" })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.startComment(snapshot.files[0].fileAnchor);
    });

    await waitFor(() => expect(result.current.canSubmit).toBe(false));
  });
});
