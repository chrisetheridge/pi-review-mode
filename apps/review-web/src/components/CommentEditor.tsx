import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CommentEditorProps {
  initialBody?: string;
  onCancel: () => void;
  onSave: (body: string) => Promise<void> | void;
}

export function CommentEditor({
  initialBody = "",
  onCancel,
  onSave
}: CommentEditorProps) {
  const [body, setBody] = useState(initialBody);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function save() {
    const trimmed = body.trim();
    if (!trimmed || saving) {
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="mt-2 max-w-[720px] overflow-hidden border border-border bg-card text-card-foreground shadow-xs"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Textarea
        ref={textareaRef}
        className="min-h-[86px] resize-y rounded-none border-0 border-border border-b bg-card focus-visible:ring-0"
        aria-label="Comment text"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void save();
          }
        }}
        placeholder="Add review feedback"
      />
      <div className="flex justify-end gap-2 p-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!body.trim() || saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}
