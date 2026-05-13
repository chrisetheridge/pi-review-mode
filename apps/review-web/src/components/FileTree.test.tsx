import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReviewFileSnapshot } from "../types";
import { FileTree } from "./FileTree";

const files: ReviewFileSnapshot[] = [
  {
    path: "src/app.ts",
    status: "modified",
    additions: 4,
    deletions: 1,
    binary: false,
    hunks: [],
    fileAnchor: { id: "file-src/app.ts", filePath: "src/app.ts", side: "file" }
  },
  {
    path: "src/components/Button.tsx",
    status: "added",
    additions: 12,
    deletions: 0,
    binary: false,
    hunks: [],
    fileAnchor: {
      id: "file-src/components/Button.tsx",
      filePath: "src/components/Button.tsx",
      side: "file"
    }
  },
  {
    path: "assets/logo.png",
    status: "binary",
    additions: 0,
    deletions: 0,
    binary: true,
    hunks: [],
    fileAnchor: {
      id: "file-assets/logo.png",
      filePath: "assets/logo.png",
      side: "file"
    }
  }
];

describe("FileTree", () => {
  it("renders folders, file status, stats, comment counts, and selection", async () => {
    const onSelect = vi.fn();
    render(
      <FileTree
        files={files}
        comments={[
          { id: "c1", anchorId: "a1", filePath: "src/app.ts", body: "One" },
          { id: "c2", anchorId: "a2", filePath: "src/app.ts", body: "Two" }
        ]}
        selectedPath="src/app.ts"
        collapsedPaths={new Set()}
        onSelect={onSelect}
        onToggleCollapse={vi.fn()}
      />
    );

    expect(screen.getByRole("treeitem", { name: "src" })).toBeTruthy();
    expect(screen.getByRole("treeitem", { name: "components" })).toBeTruthy();

    const selectedItem = screen.getByRole("button", {
      name: /selected.*src\/app\.ts/i
    });
    expect(selectedItem.getAttribute("aria-current")).toBe("true");
    expect(within(selectedItem).getByText("M")).toBeTruthy();
    expect(within(selectedItem).getByText("+4 -1")).toBeTruthy();
    expect(within(selectedItem).getByText("2 comments")).toBeTruthy();

    const logoItem = screen.getByRole("button", {
      name: /^assets\/logo\.png$/i
    });
    await userEvent.click(logoItem);
    expect(onSelect).toHaveBeenCalledWith("assets/logo.png");
  });

  it("filters files while preserving matching folder context", async () => {
    render(
      <FileTree
        files={files}
        comments={[]}
        selectedPath={null}
        collapsedPaths={new Set()}
        onSelect={vi.fn()}
        onToggleCollapse={vi.fn()}
      />
    );

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Filter files" }),
      "button"
    );

    expect(screen.getByRole("treeitem", { name: "src" })).toBeTruthy();
    expect(screen.getByRole("treeitem", { name: "components" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /^src\/components\/Button\.tsx$/i })
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /src\/app\.ts/i })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /assets\/logo\.png/i })
    ).toBeNull();
  });

  it("toggles collapsed files", async () => {
    const onToggleCollapse = vi.fn();
    render(
      <FileTree
        files={files}
        comments={[]}
        selectedPath={null}
        collapsedPaths={new Set(["assets/logo.png"])}
        onSelect={vi.fn()}
        onToggleCollapse={onToggleCollapse}
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Expand assets/logo.png" })
    );
    expect(onToggleCollapse).toHaveBeenCalledWith("assets/logo.png");
  });

  it("collapses and expands folders in the tree", async () => {
    render(
      <FileTree
        files={files}
        comments={[]}
        selectedPath={null}
        collapsedPaths={new Set()}
        onSelect={vi.fn()}
        onToggleCollapse={vi.fn()}
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Collapse src folder" })
    );

    expect(screen.queryByRole("treeitem", { name: "components" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^src\/app\.ts$/i })
    ).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: "Expand src folder" })
    );

    expect(screen.getByRole("treeitem", { name: "components" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /^src\/app\.ts$/i })
    ).toBeTruthy();
  });
});
