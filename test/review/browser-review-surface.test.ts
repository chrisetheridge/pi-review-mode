import { describe, expect, it } from "vitest";
import { openBrowserReviewSurface } from "../../src/review/browser-review-surface.js";
import { parseReviewDiff } from "../../src/review/diff-parser.js";
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

describe("openBrowserReviewSurface", () => {
  it("calls the submit callback before server shutdown finishes", async () => {
    let finishShutdown!: () => void;
    let shutdownStarted = false;
    let submittedPrompt: string | undefined;
    const shutdownFinished = new Promise<void>((resolve) => {
      finishShutdown = resolve;
    });

    const resultPromise = openBrowserReviewSurface(snapshot(), {
      assetsDir: "unused",
      opener: async () => undefined,
      onSubmitPrompt: async (prompt) => {
        submittedPrompt = prompt;
      },
      serverFactory: () => ({
        start: async () => ({
          url: "http://127.0.0.1:1/?token=test-token",
          port: 1,
          token: "test-token"
        }),
        waitForCompletion: async () => ({
          prompt: "Review prompt",
          closed: false
        }),
        shutdown: async () => {
          shutdownStarted = true;
          await shutdownFinished;
        }
      })
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(submittedPrompt).toBe("Review prompt");
    expect(shutdownStarted).toBe(true);

    finishShutdown();
    await expect(resultPromise).resolves.toEqual({
      prompt: "Review prompt",
      closed: false
    });
  });
});
