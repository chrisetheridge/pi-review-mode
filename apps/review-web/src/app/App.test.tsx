import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReviewSnapshot } from "../review/model";
import type { ReviewTransport } from "../review/transport/types";
import { App } from "./App";

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
    const transport = fakeTransport({
      load: async () => ({
        snapshot: snapshotWithFiles(["src/alpha.ts", "src/beta.ts"]),
        drafts: []
      })
    });

    render(<App transport={transport} />);

    await screen.findByRole("heading", { name: "src/alpha.ts" });
    scrollIntoView.mockClear();

    await user.click(screen.getByRole("button", { name: "src/beta.ts" }));

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  });
});

function fakeTransport(
  overrides: Partial<ReviewTransport> = {}
): ReviewTransport {
  return {
    load: async () => ({
      snapshot: snapshotWithFiles(["src/alpha.ts"]),
      drafts: []
    }),
    saveDraft: async (draft) => ({
      id: draft.anchor.id,
      anchorId: draft.anchor.id,
      filePath: draft.anchor.filePath,
      body: draft.body,
      updatedAt: "2026-05-14T00:00:00.000Z",
      source: "user"
    }),
    deleteDraft: async () => undefined,
    close: async () => undefined,
    submit: async () => ({ prompt: "prompt" }),
    ...overrides
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
