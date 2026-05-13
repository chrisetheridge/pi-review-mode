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
    <article className="mt-2 max-w-[720px] overflow-hidden rounded-lg border border-review-light-border bg-review-light-low dark:border-review-border dark:bg-review-high">
      <p className="m-0 whitespace-pre-wrap p-2.5 text-review-light-text dark:text-review-text">
        {comment.body}
      </p>
      <div className="flex justify-end gap-2 p-2">
        <button
          type="button"
          className="min-h-8 rounded-md border border-review-light-border px-3 font-bold text-review-light-muted hover:border-review-light-primary dark:border-review-border dark:text-review-muted dark:hover:border-review-primary"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
        <button
          type="button"
          className="min-h-8 rounded-md border border-review-light-red px-3 font-bold text-review-light-red dark:border-review-red dark:text-review-red"
          onClick={() => void onDelete(comment.anchorId)}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
