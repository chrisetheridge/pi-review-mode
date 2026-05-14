import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
    <Card className="mt-2 max-w-[720px] gap-0 py-0" size="sm">
      <article className="contents">
        <CardContent className="p-2.5">
          {comment.source === "agent" ? (
            <Badge variant="secondary" className="mb-2 text-xs">
              Agent
            </Badge>
          ) : null}
          <p className="m-0 whitespace-pre-wrap text-card-foreground">
            {comment.body}
          </p>
        </CardContent>
        <CardFooter className="justify-end gap-2 p-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void onDelete(comment.anchorId)}
          >
            Delete
          </Button>
        </CardFooter>
      </article>
    </Card>
  );
}
