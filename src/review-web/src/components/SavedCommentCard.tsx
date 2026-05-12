import { useState } from "react";
import type { DiffAnchor, SavedComment } from "../types";
import { CommentEditor } from "./CommentEditor";

interface SavedCommentCardProps {
  comment: SavedComment;
  anchor: DiffAnchor;
  onDelete: (anchorId: string) => Promise<void> | void;
  onSave: (anchor: DiffAnchor, body: string) => Promise<void> | void;
}

export function SavedCommentCard({
  comment,
  anchor,
  onDelete,
  onSave
}: SavedCommentCardProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <CommentEditor
        initialBody={comment.body}
        onCancel={() => setEditing(false)}
        onSave={async (body) => {
          await onSave(anchor, body);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <article className="saved-comment">
      <p>{comment.body}</p>
      <div className="saved-comment__actions">
        <button
          type="button"
          className="button button--ghost"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
        <button
          type="button"
          className="button button--danger"
          onClick={() => void onDelete(comment.anchorId)}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
