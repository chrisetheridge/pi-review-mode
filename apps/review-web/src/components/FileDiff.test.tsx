import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DiffAnchor, ReviewFileSnapshot, SavedComment } from "../types";
import { FileDiff } from "./FileDiff";

const diffViewRender = vi.fn();
let latestObserver:
  | {
      callback: IntersectionObserverCallback;
      observe: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
    }
  | undefined;

vi.mock("@git-diff-view/react", () => ({
  DiffModeEnum: { Unified: 1 },
  SplitSide: { old: "old", new: "new" },
  DiffView: (props: unknown) => {
    diffViewRender(props);
    return <div data-testid="diff-view" />;
  }
}));

vi.mock("@git-diff-view/react/styles/diff-view-pure.css", () => ({}));

describe("FileDiff rendering", () => {
  beforeEach(() => {
    diffViewRender.mockClear();
    latestObserver = undefined;
    class MockIntersectionObserver {
      callback: IntersectionObserverCallback;
      observe = vi.fn();
      disconnect = vi.fn();

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        latestObserver = this;
      }
    }
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not rerender an unchanged diff when parent state changes", () => {
    const file = fileWithPatch();
    const comments: SavedComment[] = [];
    const activeEditors: { anchor: DiffAnchor }[] = [];
    const noop = vi.fn();

    const { rerender } = render(
      <FileDiff
        file={file}
        collapsed={false}
        comments={comments}
        activeEditors={activeEditors}
        viewed={false}
        onToggleViewed={noop}
        onToggleCollapse={noop}
        onStartComment={noop}
        onCancelEditor={noop}
        onSaveComment={noop}
        onDeleteComment={noop}
        theme="light"
      />
    );

    rerender(
      <FileDiff
        file={file}
        collapsed={false}
        comments={comments}
        activeEditors={activeEditors}
        viewed={false}
        onToggleViewed={noop}
        onToggleCollapse={noop}
        onStartComment={noop}
        onCancelEditor={noop}
        onSaveComment={noop}
        onDeleteComment={noop}
        theme="light"
      />
    );

    expect(diffViewRender).toHaveBeenCalledTimes(1);
  });

  it("defers rendering the diff body until the file is near the viewport", () => {
    const noop = vi.fn();

    render(
      <FileDiff
        file={fileWithPatch()}
        collapsed={false}
        comments={[]}
        activeEditors={[]}
        viewed={false}
        virtualizeBody
        onToggleViewed={noop}
        onToggleCollapse={noop}
        onStartComment={noop}
        onCancelEditor={noop}
        onSaveComment={noop}
        onDeleteComment={noop}
        theme="light"
      />
    );

    expect(diffViewRender).not.toHaveBeenCalled();

    act(() => {
      latestObserver?.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    expect(diffViewRender).toHaveBeenCalledTimes(1);
  });
});

function fileWithPatch(): ReviewFileSnapshot {
  return {
    path: "src/example.ts",
    status: "modified",
    additions: 1,
    deletions: 0,
    binary: false,
    patch: [
      "diff --git a/src/example.ts b/src/example.ts",
      "--- a/src/example.ts",
      "+++ b/src/example.ts",
      "@@ -1,1 +1,2 @@",
      " const value = 1;",
      "+const next = 2;"
    ].join("\n"),
    hunks: [
      {
        header: "@@ -1,1 +1,2 @@",
        rows: [
          {
            type: "context",
            oldLineNumber: 1,
            newLineNumber: 1,
            text: "const value = 1;",
            anchor: {
              id: "line:src/example.ts:1",
              filePath: "src/example.ts",
              side: "new",
              newLineNumber: 1
            }
          },
          {
            type: "add",
            newLineNumber: 2,
            text: "const next = 2;",
            anchor: {
              id: "line:src/example.ts:2",
              filePath: "src/example.ts",
              side: "new",
              newLineNumber: 2
            }
          }
        ]
      }
    ],
    fileAnchor: {
      id: "file:src/example.ts",
      filePath: "src/example.ts",
      side: "file"
    }
  };
}
