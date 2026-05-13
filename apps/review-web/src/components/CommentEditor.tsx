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
      className="mt-2 max-w-[720px] overflow-hidden rounded-lg border border-review-light-border bg-review-light-bg dark:border-review-border dark:bg-review-bg"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <textarea
        ref={textareaRef}
        className="block min-h-[86px] w-full resize-y rounded-t-lg border-0 border-review-light-border border-b bg-review-light-bg p-2.5 text-review-light-text outline-none placeholder:text-review-light-outline focus:border-review-light-primary dark:border-review-border dark:bg-review-bg dark:text-review-text dark:placeholder:text-review-outline dark:focus:border-review-primary"
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
        <button
          type="button"
          className="min-h-8 rounded-md border border-review-light-border px-3 font-bold text-review-light-muted hover:border-review-light-primary dark:border-review-border dark:text-review-muted dark:hover:border-review-primary"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="min-h-8 rounded-md border border-review-light-primary bg-review-light-primary px-3 font-bold text-review-light-surface disabled:cursor-not-allowed disabled:opacity-55 dark:border-review-primary dark:bg-review-primary dark:text-review-bg"
          disabled={!body.trim() || saving}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
