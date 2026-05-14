import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DiffAnchor } from "../model";
import { SavedCommentCard } from "./SavedCommentCard";

describe("SavedCommentCard", () => {
  it("shows an Agent badge for agent-sourced comments", () => {
    render(
      <SavedCommentCard
        comment={{
          id: "comment-1",
          anchorId: "file:file.txt",
          filePath: "file.txt",
          body: "agent note",
          source: "agent"
        }}
        anchor={anchor}
        onDelete={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText("Agent")).toBeTruthy();
  });

  it("does not show an Agent badge for user comments", () => {
    render(
      <SavedCommentCard
        comment={{
          id: "comment-1",
          anchorId: "file:file.txt",
          filePath: "file.txt",
          body: "user note",
          source: "user"
        }}
        anchor={anchor}
        onDelete={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.queryByText("Agent")).toBeNull();
  });
});

const anchor: DiffAnchor = {
  id: "file:file.txt",
  filePath: "file.txt",
  side: "file"
};
