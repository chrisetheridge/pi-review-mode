import { useEffect, useMemo, useState } from "react";
import {
  closeReviewWithBeacon,
  createReviewApi,
  type ReviewApi,
  readTokenFromLocation
} from "./api";
import { FileDiff } from "./components/FileDiff";
import { FileTree } from "./components/FileTree";
import type { DiffAnchor, ReviewSnapshot, SavedComment } from "./types";

interface ActiveEditor {
  anchor: DiffAnchor;
}

interface AppProps {
  api?: ReviewApi;
  token?: string;
}

export function App({ api: providedApi, token: providedToken }: AppProps) {
  const token = providedToken ?? readTokenFromLocation();
  const api = useMemo(
    () => providedApi ?? createReviewApi(token),
    [providedApi, token]
  );
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
    if (!token || providedApi) return;
    const closeOnPageHide = () => closeReviewWithBeacon(token);
    window.addEventListener("pagehide", closeOnPageHide);
    return () => window.removeEventListener("pagehide", closeOnPageHide);
  }, [providedApi, token]);

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

  if (loading) {
    return <main className="state-page">Loading review...</main>;
  }

  if (error) {
    return (
      <main className="state-page state-page--error">
        <h1>Review unavailable</h1>
        <p>{error}</p>
      </main>
    );
  }

  if (!snapshot || snapshot.files.length === 0) {
    return (
      <main className="state-page">
        <h1>No changes to review</h1>
        <p>The selected snapshot does not contain reviewable files.</p>
      </main>
    );
  }

  if (submittedPrompt) {
    return (
      <main className="state-page">
        <h1>Review submitted</h1>
        <p>Your feedback was sent back to Pi.</p>
      </main>
    );
  }

  return (
    <div className="review-app">
      <FileTree
        files={snapshot.files}
        comments={comments}
        selectedPath={selectedPath}
        collapsedPaths={collapsedPaths}
        onSelect={setSelectedPath}
        onToggleCollapse={toggleCollapse}
      />
      <main className="review-main">
        <header className="review-toolbar">
          <div>
            <h1>{snapshot.title ?? "Review changes"}</h1>
            <p>
              {snapshot.stats.filesChanged} files, +{snapshot.stats.additions} -
              {snapshot.stats.deletions}
            </p>
          </div>
          <div className="review-toolbar__actions">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => void closeReview()}
            >
              Close
            </button>
            <button
              type="button"
              className="button button--primary"
              disabled={comments.length === 0 || activeEditors.length > 0}
              onClick={() => void submitReview()}
            >
              Submit
            </button>
          </div>
        </header>
        {submitError ? <div className="submit-error">{submitError}</div> : null}
        <div className="diff-stack">
          {snapshot.files.map((file) => (
            <FileDiff
              key={file.path}
              file={file}
              collapsed={collapsedPaths.has(file.path)}
              comments={comments.filter(
                (comment) => comment.filePath === file.path
              )}
              activeEditors={activeEditors.filter(
                (editor) => editor.anchor.filePath === file.path
              )}
              onToggleCollapse={toggleCollapse}
              onStartComment={startComment}
              onCancelEditor={cancelEditor}
              onSaveComment={saveComment}
              onDeleteComment={deleteComment}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
