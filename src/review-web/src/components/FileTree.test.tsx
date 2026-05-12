import { render, screen } from "@testing-library/react";
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
  it("renders file status, stats, comment counts, and selection", async () => {
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

    const selectedItem = screen
      .getAllByRole("button", { name: /src\/app\.ts/i })
      .find((button) => button.className.includes("file-tree__item"));
    expect(selectedItem?.className).toContain("file-tree__item--selected");
    expect(screen.getByText("+4 -1")).toBeTruthy();
    expect(screen.getByText("2 comments")).toBeTruthy();

    const logoItem = screen
      .getAllByRole("button", { name: /assets\/logo\.png/i })
      .find((button) => button.className.includes("file-tree__item"));
    expect(logoItem).toBeTruthy();
    await userEvent.click(logoItem as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith("assets/logo.png");
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
});
