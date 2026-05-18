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
  it("hides the tag filter when no saved comments have tags", async () => {
    const transport = fakeTransport({
      load: async () => ({
        snapshot: snapshotWithFiles(["src/alpha.ts"]),
        drafts: [
          {
            id: "file:src/alpha.ts",
            anchorId: "file:src/alpha.ts",
            filePath: "src/alpha.ts",
            body: "untagged",
            source: "agent",
            tags: []
          }
        ]
      })
    });

    render(<App transport={transport} />);

    await screen.findByText("untagged");
    expect(screen.queryByRole("group", { name: "Tag filters" })).toBeNull();
  });

  it("filters saved comment cards by selected tags with OR semantics", async () => {
    const user = userEvent.setup();
    const transport = fakeTransport({
      load: async () => ({
        snapshot: snapshotWithFiles(["src/alpha.ts", "src/beta.ts"]),
        drafts: [
          {
            id: "file:src/alpha.ts",
            anchorId: "file:src/alpha.ts",
            filePath: "src/alpha.ts",
            body: "spec note",
            source: "agent",
            tags: ["spec"]
          },
          {
            id: "file:src/beta.ts",
            anchorId: "file:src/beta.ts",
            filePath: "src/beta.ts",
            body: "bug note",
            source: "agent",
            tags: ["bug"]
          },
          {
            id: "untagged:src/beta.ts",
            anchorId: "file:src/beta.ts",
            filePath: "src/beta.ts",
            body: "untagged note",
            source: "user",
            tags: []
          }
        ]
      })
    });

    render(<App transport={transport} />);

    await screen.findByText("spec note");
    expect(screen.getByRole("group", { name: "Tag filters" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Filter spec" }));
    expect(screen.getByText("spec note")).toBeTruthy();
    expect(screen.queryByText("bug note")).toBeNull();
    expect(screen.queryByText("untagged note")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Filter bug" }));
    expect(screen.getByText("spec note")).toBeTruthy();
    expect(screen.getByText("bug note")).toBeTruthy();
    expect(screen.queryByText("untagged note")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Clear tag filters" }));
    expect(screen.getByText("spec note")).toBeTruthy();
    expect(screen.getByText("bug note")).toBeTruthy();
    expect(screen.getByText("untagged note")).toBeTruthy();
  });

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
