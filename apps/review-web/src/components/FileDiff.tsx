import { DiffModeEnum, DiffView, SplitSide } from "@git-diff-view/react";
import "@git-diff-view/react/styles/diff-view-pure.css";
import {
  CheckSquare,
  ChevronDown,
  ChevronUp,
  MessageSquareMore,
  Square
} from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  viewed: boolean;
  onToggleViewed: (path: string) => void;
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
  viewed,
  onToggleViewed,
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
      className="mb-4 overflow-hidden border border-border bg-card text-card-foreground shadow-xs"
      aria-label={`Diff for ${file.path}`}
    >
      <header className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 border-border border-b bg-muted/50 px-3.5 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${file.path}`}
          onClick={() => onToggleCollapse(file.path)}
        >
          {collapsed ? (
            <ChevronUp aria-hidden="true" className="size-4" />
          ) : (
            <ChevronDown aria-hidden="true" className="size-4" />
          )}
        </Button>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="m-0 truncate font-mono text-[0.92rem] font-semibold">
              {file.path}
            </h2>
          </div>
          {file.oldPath && file.oldPath !== file.path ? (
            <p className="mt-1 text-muted-foreground text-xs">
              Renamed from {file.oldPath}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="font-mono text-xs text-muted-foreground"
          >
            <span className="sr-only">
              +{file.additions} -{file.deletions}
            </span>
            <span aria-hidden="true" className="font-semibold text-[#1a7f37]">
              +{file.additions}
            </span>{" "}
            <span aria-hidden="true" className="font-semibold text-[#cf222e]">
              -{file.deletions}
            </span>
          </Badge>
          <label
            className={cn(
              "inline-flex min-h-8 items-center gap-1 border px-2.5 text-sm transition-colors hover:bg-muted",
              viewed
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground"
            )}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={viewed}
              aria-label={`Viewed ${file.path}`}
              onChange={() => onToggleViewed(file.path)}
            />
            {viewed ? (
              <CheckSquare aria-hidden="true" className="size-4" />
            ) : (
              <Square aria-hidden="true" className="size-4" />
            )}
            Viewed
          </label>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Add file comment"
            onClick={() => onStartComment(file.fileAnchor)}
          >
            <MessageSquareMore aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </header>
      {collapsed ? null : (
        <div>
          {renderCommentSurface(file.fileAnchor)}
          {file.binary ? (
            <div className="px-3.5 py-5 text-muted-foreground">
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
                    <div className="border-border border-y bg-card px-4 py-2">
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
