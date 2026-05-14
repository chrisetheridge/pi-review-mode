import { EventEmitter } from "node:events";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ReviewSnapshot } from "../../src/review/index.js";
import { parseReviewDiff } from "../../src/review/snapshot/parse-diff.js";
import { openGlimpseReviewSurface } from "../../src/review/surface/glimpse.js";
import type { GlimpseWindowLike } from "../../src/review/surface/glimpse.types.js";

class FakeGlimpseWindow extends EventEmitter implements GlimpseWindowLike {
  readonly sentScripts: string[] = [];
  loadedFile: string | undefined;
  closed = false;

  send(js: string): void {
    this.sentScripts.push(js);
  }

  loadFile(path: string): void {
    this.loadedFile = path;
  }

  close(): void {
    this.closed = true;
    this.emit("closed");
  }
}

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

function parseLastHostMessage(window: FakeGlimpseWindow) {
  const script = window.sentScripts.at(-1) ?? "";
  const match = script.match(/window\.__PI_REVIEW_RECEIVE__\((.*)\);?$/);
  if (!match) throw new Error(`Unable to parse host script: ${script}`);
  return JSON.parse(match[1]);
}

describe("openGlimpseReviewSurface", () => {
  it("loads bundled index.html and responds to ready", async () => {
    const fakeWindow = new FakeGlimpseWindow();
    const reviewSnapshot = snapshot();

    void openGlimpseReviewSurface(reviewSnapshot, {
      assetsDir: join(process.cwd(), "test/fixtures/review-assets"),
      openWindow: () => fakeWindow
    });

    expect(fakeWindow.loadedFile).toBe(
      join(process.cwd(), "test/fixtures/review-assets", "index.html")
    );

    fakeWindow.emit("message", {
      type: "review:ready",
      requestId: "r1"
    });

    expect(parseLastHostMessage(fakeWindow)).toMatchObject({
      type: "review:response",
      requestId: "r1",
      ok: true,
      data: {
        snapshot: { id: "snapshot" },
        drafts: []
      }
    });
    fakeWindow.emit("message", { type: "review:cancel", requestId: "cancel" });
  });

  it("saves drafts and submits a prompt", async () => {
    const fakeWindow = new FakeGlimpseWindow();
    const reviewSnapshot = snapshot();
    const resultPromise = openGlimpseReviewSurface(reviewSnapshot, {
      assetsDir: join(process.cwd(), "test/fixtures/review-assets"),
      openWindow: () => fakeWindow
    });
    const anchorId = reviewSnapshot.files[0].anchor.id;

    fakeWindow.emit("message", {
      type: "review:save-draft",
      requestId: "save",
      anchorId,
      body: "Please fix this."
    });
    expect(parseLastHostMessage(fakeWindow)).toMatchObject({
      requestId: "save",
      ok: true,
      data: { draft: { body: "Please fix this." } }
    });

    fakeWindow.emit("message", { type: "review:submit", requestId: "submit" });
    const submitResponse = parseLastHostMessage(fakeWindow);
    expect(submitResponse).toMatchObject({
      requestId: "submit",
      ok: true,
      data: { prompt: expect.stringContaining("Please fix this.") }
    });
    await expect(resultPromise).resolves.toMatchObject({
      closed: false,
      prompt: expect.stringContaining("Please fix this.")
    });
  });

  it("resolves closed when the window closes", async () => {
    const fakeWindow = new FakeGlimpseWindow();
    const resultPromise = openGlimpseReviewSurface(snapshot(), {
      assetsDir: join(process.cwd(), "test/fixtures/review-assets"),
      openWindow: () => fakeWindow
    });

    fakeWindow.emit("closed");

    await expect(resultPromise).resolves.toEqual({ closed: true });
  });

  it("returns host errors without resolving the review", async () => {
    const fakeWindow = new FakeGlimpseWindow();
    void openGlimpseReviewSurface(snapshot(), {
      assetsDir: join(process.cwd(), "test/fixtures/review-assets"),
      openWindow: () => fakeWindow
    });

    fakeWindow.emit("message", {
      type: "review:save-draft",
      requestId: "bad",
      anchorId: "missing",
      body: "note"
    });

    expect(parseLastHostMessage(fakeWindow)).toEqual({
      type: "review:response",
      requestId: "bad",
      ok: false,
      error: "Unknown review anchor."
    });
    fakeWindow.emit("closed");
  });
});
