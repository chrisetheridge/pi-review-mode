import { useCallback, useEffect, useState } from "react";
import type { ReviewTransport } from "./review-transport";
import type { DiffAnchor, ReviewSnapshot, SavedComment } from "./types";

interface ActiveEditor {
  anchor: DiffAnchor;
}

interface UseReviewSurfaceStateOptions {
  transport: ReviewTransport;
}

export function useReviewSurfaceState({
  transport
}: UseReviewSurfaceStateOptions) {
  const [snapshot, setSnapshot] = useState<ReviewSnapshot | null>(null);
  const [comments, setComments] = useState<SavedComment[]>([]);
  const [activeEditors, setActiveEditors] = useState<ActiveEditor[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(
    () => new Set()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedPrompt, setSubmittedPrompt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await transport.load();
        if (cancelled) return;
        setSnapshot(result.snapshot);
        setComments(result.drafts);
        setSelectedPath(result.snapshot.files[0]?.path ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load review."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [transport]);

  const startComment = useCallback((anchor: DiffAnchor) => {
    setActiveEditors((current) =>
      current.some((editor) => editor.anchor.id === anchor.id)
        ? current
        : [...current, { anchor }]
    );
  }, []);

  const cancelEditor = useCallback((anchorId: string) => {
    setActiveEditors((current) =>
      current.filter((editor) => editor.anchor.id !== anchorId)
    );
  }, []);

  const saveComment = useCallback(
    async (anchor: DiffAnchor, body: string) => {
      const saved = await transport.saveDraft({ anchor, body });
      setComments((current) => [
        saved,
        ...current.filter((comment) => comment.anchorId !== saved.anchorId)
      ]);
      cancelEditor(anchor.id);
    },
    [cancelEditor, transport]
  );

  const deleteComment = useCallback(
    async (anchorId: string) => {
      await transport.deleteDraft(anchorId);
      setComments((current) =>
        current.filter((comment) => comment.anchorId !== anchorId)
      );
    },
    [transport]
  );

  const toggleCollapse = useCallback((path: string) => {
    setCollapsedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const collapsePath = useCallback((path: string) => {
    setCollapsedPaths((current) => {
      if (current.has(path)) {
        return current;
      }
      const next = new Set(current);
      next.add(path);
      return next;
    });
  }, []);

  const expandPath = useCallback((path: string) => {
    setCollapsedPaths((current) => {
      if (!current.has(path)) {
        return current;
      }
      const next = new Set(current);
      next.delete(path);
      return next;
    });
  }, []);

  const closeReview = useCallback(async () => {
    await transport.close();
  }, [transport]);

  const submitReview = useCallback(async () => {
    setSubmitError(null);
    if (comments.length === 0) {
      setSubmitError("Add at least one saved comment before submitting.");
      return;
    }
    if (activeEditors.length > 0) {
      setSubmitError("Save or cancel unsaved comments before submitting.");
      return;
    }
    try {
      const response = await transport.submit();
      setSubmittedPrompt(response.prompt);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Unable to submit review."
      );
    }
  }, [activeEditors.length, comments.length, transport]);

  return {
    snapshot,
    comments,
    activeEditors,
    selectedPath,
    collapsedPaths,
    loading,
    error,
    submitError,
    submittedPrompt,
    canSubmit: comments.length > 0 && activeEditors.length === 0,
    setSelectedPath,
    startComment,
    cancelEditor,
    saveComment,
    deleteComment,
    toggleCollapse,
    collapsePath,
    expandPath,
    closeReview,
    submitReview
  };
}
