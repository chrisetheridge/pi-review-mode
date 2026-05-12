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
      <div className="comment-surface">
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
    <section className="file-diff" aria-label={`Diff for ${file.path}`}>
      <header className="file-diff__header">
        <button
          type="button"
          className="file-diff__collapse"
          onClick={() => onToggleCollapse(file.path)}
        >
          {collapsed ? "+" : "-"}
        </button>
        <div>
          <h2>{file.path}</h2>
          {file.oldPath && file.oldPath !== file.path ? (
            <p>Renamed from {file.oldPath}</p>
          ) : null}
        </div>
        <span className={`file-diff__status file-diff__status--${file.status}`}>
          {file.status}
        </span>
        <span className="file-diff__stats">
          +{file.additions} -{file.deletions}
        </span>
      </header>
      {collapsed ? null : (
        <div className="file-diff__body">
          <div className="file-comment">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => onStartComment(file.fileAnchor)}
            >
              Add file comment
            </button>
            {renderCommentSurface(file.fileAnchor)}
          </div>
          {file.binary ? (
            <div className="binary-state">
              Binary file. Line comments are unavailable.
            </div>
          ) : (
            file.hunks.map((hunk) => (
              <div
                className="diff-hunk"
                key={`${file.path}-${hunk.rows[0]?.anchor.id ?? hunk.header}`}
              >
                <div className="diff-hunk__header">{hunk.header}</div>
                {hunk.rows.map((row) => (
                  <div className="diff-row-wrap" key={row.anchor.id}>
                    <button
                      type="button"
                      className={`diff-row diff-row--${row.type}`}
                      onClick={() => onStartComment(row.anchor)}
                      aria-label={`Comment on ${file.path} row ${row.anchor.rowIndex ?? ""}`}
                    >
                      <span className="diff-row__line diff-row__line--old">
                        {lineNumber(row.oldLineNumber)}
                      </span>
                      <span className="diff-row__line diff-row__line--new">
                        {lineNumber(row.newLineNumber)}
                      </span>
                      <span className="diff-row__prefix">
                        {rowPrefix(row.type)}
                      </span>
                      <code>{row.text}</code>
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
