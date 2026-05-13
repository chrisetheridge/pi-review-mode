import { render, screen, waitFor, within } from "@testing-library/react";
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

  it("renders the production dark review shell with the unified diff", async () => {
    const api = makeApi();
    render(<App api={api} token="test-token" />);

    expect(await screen.findByText("Pi Review Mode")).toBeTruthy();
    expect(
      screen.getByRole("navigation", { name: "Changed files" })
    ).toBeTruthy();
    expect(screen.getByRole("region", { name: "Unified diff" })).toBeTruthy();
    expect(screen.getByText("const value = 1;")).toBeTruthy();
    expect(
      screen.queryByRole("toolbar", { name: "Prototype variants" })
    ).toBeNull();
  });

  it("defaults to persisted light mode and switches back to dark mode", async () => {
    window.localStorage.setItem("pi-review-mode-theme", "light");
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
    await userEvent.click(screen.getByRole("button", { name: /row 0/i }));

    const submit = screen.getByRole("button", { name: "Submit" });
    expect(submit.hasAttribute("disabled")).toBe(true);
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

    const rowButton = await screen.findByRole("button", { name: /row 0/i });
    await userEvent.click(rowButton);
    const row = screen.getByTestId("diff-row-wrap-row-1");
    await userEvent.type(
      within(row).getByLabelText("Comment text"),
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
