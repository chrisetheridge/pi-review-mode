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
    <article className="mt-2 max-w-[720px] overflow-hidden rounded-lg border border-[#424754] bg-[#1f2a3c]">
      <p className="m-0 whitespace-pre-wrap p-2.5 text-[#d8e3fb]">
        {comment.body}
      </p>
      <div className="flex justify-end gap-2 p-2">
        <button
          type="button"
          className="min-h-8 rounded-md border border-[#424754] px-3 font-bold text-[#c2c6d6] hover:border-[#adc6ff]"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
        <button
          type="button"
          className="min-h-8 rounded-md border border-[#ffb4ab] px-3 font-bold text-[#ffb4ab]"
          onClick={() => void onDelete(comment.anchorId)}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
