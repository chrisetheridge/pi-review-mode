import { afterEach, describe, expect, it, vi } from "vitest";
import reviewModeExtension from "../src/index.js";
import { openBrowserReviewSurface } from "../src/review/browser-review-surface.js";

vi.mock("../src/review/browser-review-surface.js", () => ({
  openBrowserReviewSurface: vi.fn()
}));

describe("review command fixture routing", () => {
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
});
