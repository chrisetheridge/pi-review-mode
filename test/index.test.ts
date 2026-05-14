import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import reviewModeExtension from "../src/index.js";
import { openBrowserReviewSurface } from "../src/review/browser-review-surface.js";
import { parseReviewDiff } from "../src/review/diff-parser.js";
import type { ReviewSnapshot } from "../src/review/types.js";

vi.mock("../src/review/browser-review-surface.js", () => ({
  openBrowserReviewSurface: vi.fn()
}));

vi.mock("../src/review/git-review-source.js", () => ({
  GitReviewSource: class {
    createBranchScope(base: string) {
      return {
        kind: "branch",
        repoRoot: "/repo",
        label: `Branch vs ${base}`,
        base
      };
    }

    createSnapshot() {
      return snapshot();
    }

    getAvailability() {
      return {
        workingTree: { available: false, reason: "none" },
        branch: { available: false, reason: "none" }
      };
    }
  }
}));

describe("review command fixture routing", () => {
  beforeEach(() => {
    delete process.env.PI_REVIEW_MODE_FIXTURES;
  });

  afterEach(() => {
    delete process.env.PI_REVIEW_MODE_FIXTURES;
    vi.mocked(openBrowserReviewSurface).mockReset();
  });

  it("blocks --fixture unless PI_REVIEW_MODE_FIXTURES=1", async () => {
    let handler:
      | Parameters<
          Parameters<typeof reviewModeExtension>[0]["registerCommand"]
        >[1]["handler"]
      | undefined;
    reviewModeExtension({
      registerCommand(_name, command) {
        handler = command.handler;
      }
    });
    const notify = vi.fn();

    await handler?.("--fixture basic", {
      cwd: process.cwd(),
      hasUI: true,
      ui: { notify }
    });

    expect(notify).toHaveBeenCalledWith(
      "Review fixtures are development-only. Set PI_REVIEW_MODE_FIXTURES=1 to use /review --fixture.",
      "error"
    );
    expect(openBrowserReviewSurface).not.toHaveBeenCalled();
  });

  it("sends a hidden agent pre-review message and seeds submitted comments", async () => {
    let handler:
      | Parameters<
          Parameters<typeof reviewModeExtension>[0]["registerCommand"]
        >[1]["handler"]
      | undefined;
    let submitTool:
      | Parameters<
          NonNullable<Parameters<typeof reviewModeExtension>[0]["registerTool"]>
        >[0]
      | undefined;
    const sendMessage = vi.fn((message) => {
      const reviewId = (message.details as { reviewId: string }).reviewId;
      void submitTool?.execute("tool-call", {
        reviewId,
        comments: [
          { anchorId: snapshot().files[0].anchor.id, body: "agent note" }
        ]
      });
    });
    const waitForIdle = vi.fn().mockResolvedValue(undefined);
    const notify = vi.fn();
    const setWorkingMessage = vi.fn();
    vi.mocked(openBrowserReviewSurface).mockResolvedValue({ closed: true });

    reviewModeExtension({
      registerCommand(_name, command) {
        handler = command.handler;
      },
      registerTool(tool) {
        submitTool = tool;
      },
      sendMessage
    });

    await handler?.("--agent --base main", {
      cwd: process.cwd(),
      hasUI: true,
      waitForIdle,
      ui: { notify, setWorkingMessage }
    });

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        customType: "review-mode-agent-prereview",
        display: false,
        content: expect.stringContaining("submit_review_mode_comments"),
        details: expect.objectContaining({ reviewId: expect.any(String) })
      }),
      { triggerTurn: true, deliverAs: "followUp" }
    );
    expect(openBrowserReviewSurface).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        seedDrafts: [
          {
            anchorId: snapshot().files[0].anchor.id,
            body: "agent note",
            source: "agent"
          }
        ]
      })
    );
    expect(setWorkingMessage).toHaveBeenNthCalledWith(
      1,
      "Running review pre-check..."
    );
    expect(setWorkingMessage).toHaveBeenLastCalledWith();
  });

  it("opens with no seeded comments when the agent does not submit tool comments", async () => {
    let handler:
      | Parameters<
          Parameters<typeof reviewModeExtension>[0]["registerCommand"]
        >[1]["handler"]
      | undefined;
    const sendMessage = vi.fn();
    const waitForIdle = vi.fn().mockResolvedValue(undefined);
    vi.mocked(openBrowserReviewSurface).mockResolvedValue({ closed: true });

    reviewModeExtension({
      registerCommand(_name, command) {
        handler = command.handler;
      },
      sendMessage
    });

    await handler?.("--agent --base main", {
      cwd: process.cwd(),
      hasUI: true,
      waitForIdle,
      ui: { notify: vi.fn(), setWorkingMessage: vi.fn() }
    });

    expect(openBrowserReviewSurface).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ seedDrafts: [] })
    );
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
      kind: "branch",
      repoRoot: "/repo",
      label: "Branch vs main",
      base: "main"
    },
    baseRef: "main",
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
