import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReviewFileSnapshot } from "../types";
import { FileDiff } from "./FileDiff";

const file: ReviewFileSnapshot = {
  path: "src/app.ts",
  status: "modified",
  additions: 1,
  deletions: 1,
  binary: false,
  fileAnchor: { id: "file-src/app.ts", filePath: "src/app.ts", side: "file" },
  hunks: [
    {
      header: "@@ -1,3 +1,3 @@",
      rows: [
        {
          type: "context",
          oldLineNumber: 1,
          newLineNumber: 1,
          text: "const keep = true;",
          anchor: {
            id: "row-1",
            filePath: "src/app.ts",
            side: "new",
            hunkIndex: 0,
            hunkHeader: "@@ -1,3 +1,3 @@",
            oldLineNumber: 1,
            newLineNumber: 1,
            rowIndex: 0,
            lineText: "const keep = true;"
          }
        },
        {
          type: "delete",
          oldLineNumber: 2,
          text: "const oldValue = 1;",
          anchor: {
            id: "row-2",
            filePath: "src/app.ts",
            side: "old",
            hunkIndex: 0,
            hunkHeader: "@@ -1,3 +1,3 @@",
            oldLineNumber: 2,
            rowIndex: 1,
            lineText: "const oldValue = 1;"
          }
        },
        {
          type: "add",
          newLineNumber: 2,
          text: "const newValue = 2;",
          anchor: {
            id: "row-3",
            filePath: "src/app.ts",
            side: "new",
            hunkIndex: 0,
            hunkHeader: "@@ -1,3 +1,3 @@",
            newLineNumber: 2,
            rowIndex: 2,
            lineText: "const newValue = 2;"
          }
        }
      ]
    }
  ]
};

describe("FileDiff", () => {
  it("renders context, delete, and add rows", () => {
    render(
      <FileDiff
        file={file}
        collapsed={false}
        comments={[]}
        activeEditors={[]}
        onToggleCollapse={vi.fn()}
        onStartComment={vi.fn()}
        onCancelEditor={vi.fn()}
        onSaveComment={vi.fn()}
        onDeleteComment={vi.fn()}
      />
    );

    expect(
      screen
        .getByRole("button", { name: /row 0/i })
        .getAttribute("data-row-type")
    ).toBe("context");
    expect(
      screen
        .getByRole("button", { name: /row 1/i })
        .getAttribute("data-row-type")
    ).toBe("delete");
    expect(
      screen
        .getByRole("button", { name: /row 2/i })
        .getAttribute("data-row-type")
    ).toBe("add");
  });

  it("saves file-level comments", async () => {
    const onStartComment = vi.fn();
    const onSaveComment = vi.fn();
    const { rerender } = render(
      <FileDiff
        file={file}
        collapsed={false}
        comments={[]}
        activeEditors={[]}
        onToggleCollapse={vi.fn()}
        onStartComment={onStartComment}
        onCancelEditor={vi.fn()}
        onSaveComment={onSaveComment}
        onDeleteComment={vi.fn()}
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Add file comment" })
    );
    expect(onStartComment).toHaveBeenCalledWith(file.fileAnchor);

    rerender(
      <FileDiff
        file={file}
        collapsed={false}
        comments={[]}
        activeEditors={[{ anchor: file.fileAnchor }]}
        onToggleCollapse={vi.fn()}
        onStartComment={onStartComment}
        onCancelEditor={vi.fn()}
        onSaveComment={onSaveComment}
        onDeleteComment={vi.fn()}
      />
    );

    await userEvent.type(screen.getByLabelText("Comment text"), "File note");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(onSaveComment).toHaveBeenCalledWith(file.fileAnchor, "File note")
    );
  });

  it("saves line-level comments on visible rows", async () => {
    const onStartComment = vi.fn();
    const onSaveComment = vi.fn();
    const lineAnchor = file.hunks[0].rows[2].anchor;
    const { rerender } = render(
      <FileDiff
        file={file}
        collapsed={false}
        comments={[]}
        activeEditors={[]}
        onToggleCollapse={vi.fn()}
        onStartComment={onStartComment}
        onCancelEditor={vi.fn()}
        onSaveComment={onSaveComment}
        onDeleteComment={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /row 2/i }));
    expect(onStartComment).toHaveBeenCalledWith(lineAnchor);

    rerender(
      <FileDiff
        file={file}
        collapsed={false}
        comments={[]}
        activeEditors={[{ anchor: lineAnchor }]}
        onToggleCollapse={vi.fn()}
        onStartComment={onStartComment}
        onCancelEditor={vi.fn()}
        onSaveComment={onSaveComment}
        onDeleteComment={vi.fn()}
      />
    );

    const row = screen.getByTestId("diff-row-wrap-row-3");
    await userEvent.type(
      within(row).getByLabelText("Comment text"),
      "Line note"
    );
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");

    await waitFor(() =>
      expect(onSaveComment).toHaveBeenCalledWith(lineAnchor, "Line note")
    );
  });

  it("does not render line comment controls for binary files", () => {
    render(
      <FileDiff
        file={{ ...file, binary: true, hunks: [] }}
        collapsed={false}
        comments={[]}
        activeEditors={[]}
        onToggleCollapse={vi.fn()}
        onStartComment={vi.fn()}
        onCancelEditor={vi.fn()}
        onSaveComment={vi.fn()}
        onDeleteComment={vi.fn()}
      />
    );

    expect(
      screen.getByText("Binary file. Line comments are unavailable.")
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /row/i })).toBeNull();
  });
});
