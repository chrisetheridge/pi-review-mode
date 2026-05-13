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
}

function lineNumber(value?: number) {
  return value == null ? "" : String(value);
}

function rowPrefix(type: string) {
  if (type === "add") return "+";
  if (type === "delete") return "-";
  return " ";
}

function rowClasses(type: string) {
  if (type === "add") {
    return "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/45 dark:hover:bg-emerald-900/45";
  }
  if (type === "delete") {
    return "bg-red-50 hover:bg-red-100 dark:bg-red-950/45 dark:hover:bg-red-900/45";
  }
  return "bg-transparent hover:bg-review-light-high dark:hover:bg-review-high";
}

function gutterClasses(type: string) {
  if (type === "add") {
    return "border-emerald-200 text-emerald-700 dark:border-emerald-300/20 dark:text-emerald-100";
  }
  if (type === "delete") {
    return "border-red-200 text-red-700 dark:border-red-300/20 dark:text-red-100";
  }
  return "border-transparent text-review-light-outline dark:text-review-outline";
}

const statusClasses: Record<string, string> = {
  added: "bg-[#d9f7e8] text-[#0b6b3a]",
  deleted: "bg-[#ffe3e3] text-[#a61b1b]",
  renamed: "bg-[#fff0c2] text-[#8a5d00]",
  copied: "bg-[#e8f2ff] text-[#334e68]",
  binary:
    "bg-review-light-high text-review-light-text dark:bg-review-high dark:text-review-text",
  modified: "bg-[#eef2f6] text-[#334e68]"
};

export function FileDiff({
  file,
  collapsed,
  comments,
  activeEditors,
  onToggleCollapse,
  onStartComment,
  onCancelEditor,
  onSaveComment,
  onDeleteComment
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
            file.hunks.map((hunk) => (
              <div
                className="min-w-0"
                key={`${file.path}-${hunk.rows[0]?.anchor.id ?? hunk.header}`}
              >
                <div className="bg-review-light-high px-3.5 py-2 font-mono text-review-light-primary text-sm dark:bg-review-high dark:text-review-primary">
                  {hunk.header}
                </div>
                {hunk.rows.map((row) => (
                  <div
                    key={row.anchor.id}
                    data-testid={`diff-row-wrap-${row.anchor.id}`}
                  >
                    <button
                      type="button"
                      className={`grid min-h-7 w-full grid-cols-[58px_58px_24px_minmax(0,1fr)] border-review-light-border border-t text-left font-mono text-sm leading-6 dark:border-[#253246] ${rowClasses(
                        row.type
                      )}`}
                      data-row-type={row.type}
                      onClick={() => onStartComment(row.anchor)}
                      aria-label={`Comment on ${file.path} row ${row.anchor.rowIndex ?? ""}`}
                    >
                      <span
                        className={`border-r px-2 py-1 text-right select-none ${gutterClasses(
                          row.type
                        )}`}
                      >
                        {lineNumber(row.oldLineNumber)}
                      </span>
                      <span
                        className={`border-r px-2 py-1 text-right select-none ${gutterClasses(
                          row.type
                        )}`}
                      >
                        {lineNumber(row.newLineNumber)}
                      </span>
                      <span className="px-2 py-1 text-center text-review-light-outline select-none dark:text-review-outline">
                        {rowPrefix(row.type)}
                      </span>
                      <code className="min-w-0 overflow-x-auto px-2 py-1 whitespace-pre text-review-light-text dark:text-review-text">
                        {row.text}
                      </code>
                    </button>
                    {renderCommentSurface(row.anchor)}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
