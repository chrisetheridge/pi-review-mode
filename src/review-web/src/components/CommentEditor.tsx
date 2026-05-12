import { useEffect, useRef, useState } from "react";

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
      className="comment-editor"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <textarea
        ref={textareaRef}
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
      <div className="comment-editor__actions">
        <button
          type="button"
          className="button button--ghost"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="button button--primary"
          disabled={!body.trim() || saving}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
