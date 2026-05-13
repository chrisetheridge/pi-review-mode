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
      className="mt-2 max-w-[720px] overflow-hidden rounded-lg border border-[#424754] bg-[#081425]"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <textarea
        ref={textareaRef}
        className="block min-h-[86px] w-full resize-y rounded-t-lg border-0 border-[#424754] border-b bg-[#081425] p-2.5 text-[#d8e3fb] outline-none placeholder:text-[#8c909f] focus:border-[#adc6ff]"
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
          className="min-h-8 rounded-md border border-[#424754] px-3 font-bold text-[#c2c6d6] hover:border-[#adc6ff]"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="min-h-8 rounded-md border border-[#adc6ff] bg-[#adc6ff] px-3 font-bold text-[#002e6a] disabled:cursor-not-allowed disabled:opacity-55"
          disabled={!body.trim() || saving}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
