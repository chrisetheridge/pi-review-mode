import { useEffect, useState } from "react";
import { closeReviewWithBeacon, type ReviewApi } from "./api";
import type { DiffAnchor, ReviewSnapshot, SavedComment } from "./types";

interface ActiveEditor {
  anchor: DiffAnchor;
}

interface UseReviewSurfaceStateOptions {
  api: ReviewApi;
  token: string;
  closeWithBeacon?: boolean;
}

export function useReviewSurfaceState({
  api,
  token,
  closeWithBeacon = true
}: UseReviewSurfaceStateOptions) {
  const [snapshot, setSnapshot] = useState<ReviewSnapshot | null>(null);
  const [comments, setComments] = useState<SavedComment[]>([]);
  const [activeEditors, setActiveEditors] = useState<ActiveEditor[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(
    () => new Set()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(
    token ? null : "Missing review token."
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedPrompt, setSubmittedPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [nextSnapshot, nextComments] = await Promise.all([
          api.getSnapshot(),
          api.getDrafts()
        ]);
        if (cancelled) return;
        setSnapshot(nextSnapshot);
        setComments(nextComments);
        setSelectedPath(nextSnapshot.files[0]?.path ?? null);
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
  }, [api, token]);

  useEffect(() => {
    if (!token) return;
    const interval = window.setInterval(() => {
      void api.heartbeat().catch(() => undefined);
    }, 15_000);
    void api.heartbeat().catch(() => undefined);
    return () => window.clearInterval(interval);
  }, [api, token]);

  useEffect(() => {
    if (!token || !closeWithBeacon) return;
    const closeOnPageHide = () => closeReviewWithBeacon(token);
    window.addEventListener("pagehide", closeOnPageHide);
    return () => window.removeEventListener("pagehide", closeOnPageHide);
  }, [closeWithBeacon, token]);

  function startComment(anchor: DiffAnchor) {
    setActiveEditors((current) =>
      current.some((editor) => editor.anchor.id === anchor.id)
        ? current
        : [...current, { anchor }]
    );
  }

  function cancelEditor(anchorId: string) {
    setActiveEditors((current) =>
      current.filter((editor) => editor.anchor.id !== anchorId)
    );
  }

  async function saveComment(anchor: DiffAnchor, body: string) {
    const saved = await api.saveDraft({ anchor, body });
    setComments((current) => [
      saved,
      ...current.filter((comment) => comment.anchorId !== saved.anchorId)
    ]);
    cancelEditor(anchor.id);
  }

  async function deleteComment(anchorId: string) {
    await api.deleteDraft(anchorId);
    setComments((current) =>
      current.filter((comment) => comment.anchorId !== anchorId)
    );
  }

  function toggleCollapse(path: string) {
    setCollapsedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  async function closeReview() {
    await api.close();
  }

  async function submitReview() {
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
      const response = await api.submit();
      setSubmittedPrompt(response.prompt);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Unable to submit review."
      );
    }
  }

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
    closeReview,
    submitReview
  };
}
