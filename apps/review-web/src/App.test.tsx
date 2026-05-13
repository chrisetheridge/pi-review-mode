import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { ReviewApi } from "./api";
import type { ReviewSnapshot, SavedComment } from "./types";

const snapshot: ReviewSnapshot = {
  id: "snapshot-1",
  title: "Working tree review",
  stats: {
    filesChanged: 1,
    additions: 1,
    deletions: 0
  },
  files: [
    {
      path: "src/app.ts",
      status: "modified",
      additions: 1,
      deletions: 0,
      binary: false,
      fileAnchor: {
        id: "file-src/app.ts",
        filePath: "src/app.ts",
        side: "file"
      },
      hunks: [
        {
          header: "@@ -1 +1 @@",
          rows: [
            {
              type: "add",
              newLineNumber: 1,
              text: "const value = 1;",
              anchor: {
                id: "row-1",
                filePath: "src/app.ts",
                side: "new",
                hunkIndex: 0,
                hunkHeader: "@@ -1 +1 @@",
                newLineNumber: 1,
                rowIndex: 0,
                lineText: "const value = 1;"
              }
            }
          ]
        }
      ]
    }
  ]
};

function makeApi(overrides: Partial<ReviewApi> = {}): ReviewApi {
  return {
    getSnapshot: vi.fn().mockResolvedValue(snapshot),
    getDrafts: vi.fn().mockResolvedValue([]),
    saveDraft: vi.fn(async ({ anchor, body }) => ({
      id: `comment-${anchor.id}`,
      anchorId: anchor.id,
      filePath: anchor.filePath,
      body
    })),
    deleteDraft: vi.fn().mockResolvedValue(undefined),
    heartbeat: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    submit: vi.fn().mockResolvedValue({ prompt: "Prompt text" }),
    ...overrides
  };
}

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("blocks submit with no saved comments", async () => {
    const api = makeApi();
    render(<App api={api} token="test-token" />);

    const submit = await screen.findByRole("button", { name: "Submit" });
    expect(submit.hasAttribute("disabled")).toBe(true);
  });

  it("renders the primary light review shell with the unified diff", async () => {
    const api = makeApi();
    render(<App api={api} token="test-token" />);

    expect(await screen.findByText("Review changes")).toBeTruthy();
    expect(screen.queryByText("Pi Review Mode")).toBeNull();
    expect(
      screen.getByRole("navigation", { name: "Changed files" })
    ).toBeTruthy();
    expect(
      screen.getByRole("searchbox", { name: "Filter files" })
    ).toBeTruthy();
    expect(screen.getByRole("region", { name: "Unified diff" })).toBeTruthy();
    expect(document.body.textContent).toContain("const value = 1");
    expect(
      screen.queryByRole("toolbar", { name: "Prototype variants" })
    ).toBeNull();
  });

  it("defaults to light mode and switches to dark mode", async () => {
    const api = makeApi();
    render(<App api={api} token="test-token" />);

    const toggle = await screen.findByRole("button", { name: "Use dark mode" });
    const shell = screen.getByTestId("review-app-shell");
    expect(shell.classList.contains("dark")).toBe(false);

    await userEvent.click(toggle);

    expect(window.localStorage.getItem("pi-review-mode-theme")).toBe("dark");
    expect(shell.classList.contains("dark")).toBe(true);
    expect(screen.getByRole("button", { name: "Use light mode" })).toBeTruthy();
  });

  it("blocks submit while unsaved editors exist", async () => {
    const api = makeApi({
      getDrafts: vi.fn().mockResolvedValue([
        {
          id: "comment-file",
          anchorId: "file-src/app.ts",
          filePath: "src/app.ts",
          body: "Saved"
        }
      ] satisfies SavedComment[])
    });
    render(<App api={api} token="test-token" />);

    await screen.findByText("Saved");
    await userEvent.click(screen.getByRole("button", { name: "+" }));

    const submit = screen.getByRole("button", { name: "Submit" });
    expect(submit.hasAttribute("disabled")).toBe(true);
  });

  it("collapses files from the sidebar toggle", async () => {
    const api = makeApi();
    render(<App api={api} token="test-token" />);

    expect(await screen.findByTestId("diff-view-src/app.ts")).toBeTruthy();

    await userEvent.click(
      screen.getAllByRole("button", { name: "Collapse src/app.ts" })[0]
    );

    expect(screen.queryByTestId("diff-view-src/app.ts")).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "Expand src/app.ts" }).length
    ).toBeGreaterThan(0);
  });

  it("marks viewed files as collapsed and reopens them when unmarked", async () => {
    const api = makeApi();
    render(<App api={api} token="test-token" />);

    expect(await screen.findByTestId("diff-view-src/app.ts")).toBeTruthy();

    const viewed = await screen.findByRole<HTMLInputElement>("checkbox", {
      name: "Viewed src/app.ts"
    });
    expect(viewed.checked).toBe(false);

    await userEvent.click(viewed);

    expect(
      screen.getByRole<HTMLInputElement>("checkbox", {
        name: "Viewed src/app.ts"
      }).checked
    ).toBe(true);
    expect(screen.queryByTestId("diff-view-src/app.ts")).toBeNull();

    await userEvent.click(
      screen.getByRole<HTMLInputElement>("checkbox", {
        name: "Viewed src/app.ts"
      })
    );

    expect(
      screen.getByRole<HTMLInputElement>("checkbox", {
        name: "Viewed src/app.ts"
      }).checked
    ).toBe(false);
    expect(await screen.findByTestId("diff-view-src/app.ts")).toBeTruthy();
  });

  it("saves file-level comments through the API", async () => {
    const api = makeApi();
    render(<App api={api} token="test-token" />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Add file comment" })
    );
    await userEvent.type(
      screen.getByLabelText("Comment text"),
      "File-level feedback"
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(api.saveDraft).toHaveBeenCalledWith({
        anchor: snapshot.files[0].fileAnchor,
        body: "File-level feedback"
      })
    );
    expect(await screen.findByText("File-level feedback")).toBeTruthy();
  });

  it("saves line-level comments through the API", async () => {
    const api = makeApi();
    render(<App api={api} token="test-token" />);

    const rowButton = await screen.findByRole("button", { name: "+" });
    await userEvent.click(rowButton);
    await userEvent.type(
      screen.getByLabelText("Comment text"),
      "Line-level feedback"
    );
    await userEvent.keyboard("{Control>}{Enter}{/Control}");

    await waitFor(() =>
      expect(api.saveDraft).toHaveBeenCalledWith({
        anchor: snapshot.files[0].hunks[0].rows[0].anchor,
        body: "Line-level feedback"
      })
    );
  });
});
