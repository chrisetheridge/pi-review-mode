import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import reviewModeExtension from "../src/index.js";
import type { ReviewSnapshot } from "../src/review/index.js";
import { parseReviewDiff } from "../src/review/snapshot/parse-diff.js";
import { openGlimpseReviewSurface } from "../src/review/surface/glimpse.js";

vi.mock("../src/review/surface/glimpse.js", () => ({
  openGlimpseReviewSurface: vi.fn()
}));

const agentDirMock = vi.hoisted(() => ({
  path: `${process.env.TMPDIR ?? "/tmp"}/pi-review-mode-test-${process.pid}`
}));

vi.mock("@earendil-works/pi-coding-agent", () => ({
  getAgentDir: () => agentDirMock.path
}));

const gitSourceMock = vi.hoisted(() => ({
  availability: undefined as
    | {
        workingTree: unknown;
        branch: unknown;
      }
    | undefined
}));

vi.mock("../src/review/source/git.js", () => ({
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
      return (
        gitSourceMock.availability ?? {
          workingTree: { available: false, reason: "none" },
          branch: { available: false, reason: "none" }
        }
      );
    }
  }
}));

describe("review command fixture routing", () => {
  beforeEach(() => {
    delete process.env.PI_REVIEW_MODE_FIXTURES;
    rmSync(agentDirMock.path, { force: true, recursive: true });
  });

  afterEach(() => {
    delete process.env.PI_REVIEW_MODE_FIXTURES;
    rmSync(agentDirMock.path, { force: true, recursive: true });
    gitSourceMock.availability = undefined;
    vi.mocked(openGlimpseReviewSurface).mockReset();
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
    expect(openGlimpseReviewSurface).not.toHaveBeenCalled();
  });

  it("passes readable labels to the review scope picker", async () => {
    let handler:
      | Parameters<
          Parameters<typeof reviewModeExtension>[0]["registerCommand"]
        >[1]["handler"]
      | undefined;
    const workingTreeScope = {
      kind: "working-tree" as const,
      repoRoot: "/repo",
      label: "Working tree changes"
    };
    const branchScope = {
      kind: "branch" as const,
      repoRoot: "/repo",
      label: "Branch vs main",
      base: "main"
    };
    gitSourceMock.availability = {
      workingTree: { available: true, scope: workingTreeScope },
      branch: { available: true, scope: branchScope }
    };
    const select = vi.fn().mockResolvedValue("Branch vs main");
    vi.mocked(openGlimpseReviewSurface).mockResolvedValue({ closed: true });

    reviewModeExtension({
      registerCommand(_name, command) {
        handler = command.handler;
      }
    });

    await handler?.("", {
      cwd: process.cwd(),
      hasUI: true,
      ui: { notify: vi.fn(), select }
    });

    expect(select).toHaveBeenCalledWith("Choose changes to review", [
      "Working tree changes",
      "Branch vs main"
    ]);
    expect(openGlimpseReviewSurface).toHaveBeenCalled();
  });

  it("runs agent pre-review by default and seeds submitted comments", async () => {
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
    vi.mocked(openGlimpseReviewSurface).mockResolvedValue({ closed: true });

    reviewModeExtension({
      registerCommand(_name, command) {
        handler = command.handler;
      },
      registerTool(tool) {
        submitTool = tool;
      },
      sendMessage
    });

    await handler?.("--base main", {
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
    expect(openGlimpseReviewSurface).toHaveBeenCalledWith(
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
    vi.mocked(openGlimpseReviewSurface).mockResolvedValue({ closed: true });

    reviewModeExtension({
      registerCommand(_name, command) {
        handler = command.handler;
      },
      sendMessage
    });

    await handler?.("--base main", {
      cwd: process.cwd(),
      hasUI: true,
      waitForIdle,
      ui: { notify: vi.fn(), setWorkingMessage: vi.fn() }
    });

    expect(openGlimpseReviewSurface).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ seedDrafts: [] })
    );
  });

  it("skips agent pre-review when global config sets agent-review false", async () => {
    let handler:
      | Parameters<
          Parameters<typeof reviewModeExtension>[0]["registerCommand"]
        >[1]["handler"]
      | undefined;
    const sendMessage = vi.fn();
    mkdirSync(join(agentDirMock.path, "extensions"), { recursive: true });
    writeFileSync(
      join(agentDirMock.path, "extensions", "pi-review-mode.json"),
      JSON.stringify({ "agent-review": false })
    );
    vi.mocked(openGlimpseReviewSurface).mockResolvedValue({ closed: true });

    reviewModeExtension({
      registerCommand(_name, command) {
        handler = command.handler;
      },
      sendMessage
    });

    await handler?.("--base main", {
      cwd: process.cwd(),
      hasUI: true,
      waitForIdle: vi.fn().mockResolvedValue(undefined),
      ui: { notify: vi.fn(), setWorkingMessage: vi.fn() }
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(openGlimpseReviewSurface).toHaveBeenCalledWith(
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
