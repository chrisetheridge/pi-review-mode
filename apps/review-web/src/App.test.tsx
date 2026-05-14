import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { ReviewApi } from "./api";
import type { ReviewSnapshot } from "./types";

const scrollIntoView = vi.fn();

Object.defineProperty(Element.prototype, "scrollIntoView", {
  configurable: true,
  value: scrollIntoView
});

afterEach(() => {
  scrollIntoView.mockClear();
});

describe("App file navigation", () => {
  it("scrolls the selected file into view when clicked in the file tree", async () => {
    const user = userEvent.setup();
    const api = createApi(snapshotWithFiles(["src/alpha.ts", "src/beta.ts"]));

    render(<App api={api} token="token" />);

    await screen.findByRole("heading", { name: "src/alpha.ts" });
    scrollIntoView.mockClear();

    await user.click(screen.getByRole("button", { name: "src/beta.ts" }));

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  });
});

function createApi(snapshot: ReviewSnapshot): ReviewApi {
  return {
    getSnapshot: vi.fn().mockResolvedValue(snapshot),
    getDrafts: vi.fn().mockResolvedValue([]),
    saveDraft: vi.fn(),
    deleteDraft: vi.fn(),
    heartbeat: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    submit: vi.fn().mockResolvedValue({ prompt: "prompt" })
  };
}

function snapshotWithFiles(paths: string[]): ReviewSnapshot {
  return {
    id: "snapshot-1",
    title: "Test snapshot",
    stats: {
      filesChanged: paths.length,
      additions: 0,
      deletions: 0
    },
    files: paths.map((path) => ({
      path,
      status: "binary",
      additions: 0,
      deletions: 0,
      binary: true,
      hunks: [],
      fileAnchor: {
        id: `file:${path}`,
        filePath: path,
        side: "file"
      }
    }))
  };
}
