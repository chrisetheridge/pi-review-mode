import { DiffModeEnum, DiffView, SplitSide } from "@git-diff-view/react";
import "@git-diff-view/react/styles/diff-view-pure.css";
import { useMemo } from "react";
import type { DiffAnchor, ReviewFileSnapshot, SavedComment } from "../types";
import { CommentEditor } from "./CommentEditor";
import { SavedCommentCard } from "./SavedCommentCard";

interface ActiveEditor {
  anchor: DiffAnchor;
}

interface FileDiffProps {
  file: ReviewFileSnapshot;
  collapsed: boolean;
  comments: SavedComment[];
  activeEditors: ActiveEditor[];
  onToggleCollapse: (path: string) => void;
  onStartComment: (anchor: DiffAnchor) => void;
  onCancelEditor: (anchorId: string) => void;
  onSaveComment: (anchor: DiffAnchor, body: string) => Promise<void> | void;
  onDeleteComment: (anchorId: string) => Promise<void> | void;
  theme?: "light" | "dark";
}

type ExtendItem =
  | { type: "comment"; comment: SavedComment; anchor: DiffAnchor }
  | { type: "editor"; anchor: DiffAnchor };

type ExtendData = {
  oldFile?: Record<string, { data: ExtendItem[] }>;
  newFile?: Record<string, { data: ExtendItem[] }>;
};

const statusClasses: Record<string, string> = {
  added: "bg-[#d9f7e8] text-[#0b6b3a]",
  deleted: "bg-[#ffe3e3] text-[#a61b1b]",
  renamed: "bg-[#fff0c2] text-[#8a5d00]",
  copied: "bg-[#e8f2ff] text-[#334e68]",
  binary:
    "bg-review-light-high text-review-light-text dark:bg-review-high dark:text-review-text",
  modified: "bg-[#eef2f6] text-[#334e68]"
};

function sideKey(side: "old" | "new") {
  return side === "old" ? "oldFile" : "newFile";
}

function addExtendItem(
  extendData: ExtendData,
  anchor: DiffAnchor,
  item: ExtendItem
) {
  if (anchor.side !== "old" && anchor.side !== "new") return;
  const lineNumber =
    anchor.side === "old" ? anchor.oldLineNumber : anchor.newLineNumber;
  if (lineNumber == null) return;
  const key = sideKey(anchor.side);
  extendData[key] ??= {};
  const lineKey = String(lineNumber);
  const existing = extendData[key]?.[lineKey]?.data ?? [];
  extendData[key] = {
    ...extendData[key],
    [lineKey]: { data: [...existing, item] }
  };
}

function buildAnchorIndex(file: ReviewFileSnapshot) {
  const old = new Map<number, DiffAnchor>();
  const next = new Map<number, DiffAnchor>();
  for (const hunk of file.hunks) {
    for (const row of hunk.rows) {
      if (row.oldLineNumber != null) old.set(row.oldLineNumber, row.anchor);
      if (row.newLineNumber != null) next.set(row.newLineNumber, row.anchor);
    }
  }
  return { old, new: next };
}

function fallbackPatch(file: ReviewFileSnapshot) {
  const oldPath = file.oldPath ?? file.path;
  const lines = [
    `diff --git a/${oldPath} b/${file.path}`,
    `--- a/${oldPath}`,
    `+++ b/${file.path}`
  ];
  for (const hunk of file.hunks) {
    lines.push(hunk.header);
    for (const row of hunk.rows) {
      const prefix =
        row.type === "add" ? "+" : row.type === "delete" ? "-" : " ";
      lines.push(`${prefix}${row.text}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function FileDiff({
  file,
  collapsed,
  comments,
  activeEditors,
  onToggleCollapse,
  onStartComment,
  onCancelEditor,
  onSaveComment,
  onDeleteComment,
  theme = "dark"
}: FileDiffProps) {
  const commentsByAnchor = comments.reduce<Record<string, SavedComment[]>>(
    (acc, comment) => {
      acc[comment.anchorId] = [...(acc[comment.anchorId] ?? []), comment];
      return acc;
    },
    {}
  );
  const editorsByAnchor = activeEditors.reduce<Record<string, ActiveEditor>>(
    (acc, editor) => {
      acc[editor.anchor.id] = editor;
      return acc;
    },
    {}
  );

  const anchorIndex = useMemo(() => buildAnchorIndex(file), [file]);
  const extendData = useMemo<ExtendData>(() => {
    const data: ExtendData = { oldFile: {}, newFile: {} };
    for (const comment of comments) {
      const anchor = findAnchorById(file, comment.anchorId);
      if (anchor)
        addExtendItem(data, anchor, { type: "comment", comment, anchor });
    }
    for (const editor of activeEditors) {
      addExtendItem(data, editor.anchor, {
        type: "editor",
        anchor: editor.anchor
      });
    }
    return data;
  }, [file, comments, activeEditors]);

  function findLineAnchor(lineNumber: number, side: SplitSide) {
    return side === SplitSide.old
      ? anchorIndex.old.get(lineNumber)
      : anchorIndex.new.get(lineNumber);
  }

  function renderCommentSurface(anchor: DiffAnchor) {
    const saved = commentsByAnchor[anchor.id] ?? [];
    const editor = editorsByAnchor[anchor.id];
    return (
      <div className="ml-[140px] max-[800px]:ml-0 max-[800px]:pl-3">
        {saved.map((comment) => (
          <SavedCommentCard
            key={comment.id}
            comment={comment}
            anchor={anchor}
            onDelete={onDeleteComment}
            onSave={onSaveComment}
          />
        ))}
        {editor ? (
          <CommentEditor
            onCancel={() => onCancelEditor(anchor.id)}
            onSave={(body) => onSaveComment(anchor, body)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <section
      className="mb-4 overflow-hidden rounded-lg border border-review-light-border bg-review-light-bg dark:border-review-border dark:bg-review-low"
      aria-label={`Diff for ${file.path}`}
    >
      <header className="grid grid-cols-[36px_minmax(0,1fr)_auto_auto] items-center gap-3 border-review-light-border border-b px-3.5 py-3 dark:border-review-border">
        <button
          type="button"
          className="text-review-light-muted hover:text-review-light-primary dark:text-review-muted dark:hover:text-review-primary"
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${file.path}`}
          onClick={() => onToggleCollapse(file.path)}
        >
          {collapsed ? "+" : "-"}
        </button>
        <div>
          <h2 className="m-0 break-words text-base font-bold">{file.path}</h2>
          {file.oldPath && file.oldPath !== file.path ? (
            <p className="mt-1 text-review-light-muted text-sm dark:text-review-muted">
              Renamed from {file.oldPath}
            </p>
          ) : null}
        </div>
        <span
          className={`inline-flex h-[22px] min-w-[22px] items-center justify-center rounded px-1.5 font-extrabold text-xs ${
            statusClasses[file.status] ?? statusClasses.modified
          }`}
        >
          {file.status}
        </span>
        <span className="font-mono text-review-light-outline text-sm dark:text-review-outline">
          +{file.additions} -{file.deletions}
        </span>
      </header>
      {collapsed ? null : (
        <div>
          <div className="border-review-light-border border-b px-3.5 py-3 dark:border-review-border">
            <button
              type="button"
              className="min-h-8 rounded-md border border-review-light-border bg-review-light-low px-3 font-bold text-review-light-text hover:border-review-light-primary dark:border-review-border dark:bg-review-high dark:text-review-text dark:hover:border-review-primary"
              onClick={() => onStartComment(file.fileAnchor)}
            >
              Add file comment
            </button>
            {renderCommentSurface(file.fileAnchor)}
          </div>
          {file.binary ? (
            <div className="px-3.5 py-5 text-review-light-muted dark:text-review-muted">
              Binary file. Line comments are unavailable.
            </div>
          ) : (
            <div
              className="review-diff-view"
              data-testid={`diff-view-${file.path}`}
            >
              <DiffView<ExtendItem[]>
                data={{
                  oldFile: { fileName: file.oldPath ?? file.path, content: "" },
                  newFile: { fileName: file.path, content: "" },
                  hunks: [file.patch ?? fallbackPatch(file)]
                }}
                diffViewMode={DiffModeEnum.Unified}
                diffViewTheme={theme}
                diffViewHighlight
                diffViewWrap={false}
                diffViewAddWidget
                extendData={extendData}
                onAddWidgetClick={(lineNumber, side) => {
                  const anchor = findLineAnchor(lineNumber, side);
                  if (anchor) onStartComment(anchor);
                }}
                renderExtendLine={({ data }) => {
                  if (!data?.length) return null;
                  return (
                    <div className="border-review-light-border border-y bg-review-light-bg px-4 py-2 dark:border-review-border dark:bg-review-low">
                      {data.map((item) =>
                        item.type === "comment" ? (
                          <SavedCommentCard
                            key={item.comment.id}
                            comment={item.comment}
                            anchor={item.anchor}
                            onDelete={onDeleteComment}
                            onSave={onSaveComment}
                          />
                        ) : (
                          <CommentEditor
                            key={`editor-${item.anchor.id}`}
                            onCancel={() => onCancelEditor(item.anchor.id)}
                            onSave={(body) => onSaveComment(item.anchor, body)}
                          />
                        )
                      )}
                    </div>
                  );
                }}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function findAnchorById(file: ReviewFileSnapshot, anchorId: string) {
  if (file.fileAnchor.id === anchorId) return file.fileAnchor;
  for (const hunk of file.hunks) {
    for (const row of hunk.rows) {
      if (row.anchor.id === anchorId) return row.anchor;
    }
  }
  return undefined;
}
