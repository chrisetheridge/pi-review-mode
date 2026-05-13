import { useEffect, useMemo, useState } from "react";
import { createReviewApi, type ReviewApi, readTokenFromLocation } from "./api";
import { FileDiff } from "./components/FileDiff";
import { FileTree } from "./components/FileTree";
import { useReviewSurfaceState } from "./use-review-surface-state";

interface AppProps {
  api?: ReviewApi;
  token?: string;
}

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "pi-review-mode-theme";

function readInitialTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      return saved;
    }
    if (window.matchMedia?.("(prefers-color-scheme: light)").matches) {
      return "light";
    }
  } catch {
    // Ignore storage access failures and keep the production dark default.
  }
  return "dark";
}

export function App({ api: providedApi, token: providedToken }: AppProps) {
  const token = providedToken ?? readTokenFromLocation();
  const api = useMemo(
    () => providedApi ?? createReviewApi(token),
    [providedApi, token]
  );
  const [theme, setTheme] = useState<Theme>(readInitialTheme);
  const isDark = theme === "dark";

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage access failures. The in-memory toggle still works.
    }
  }, [theme]);

  const themedFullscreen = `grid min-h-screen place-content-center bg-review-light-bg p-6 text-center text-review-light-text ${
    isDark ? "dark" : ""
  } dark:bg-review-bg dark:text-review-text`;

  const {
    snapshot,
    comments,
    activeEditors,
    selectedPath,
    collapsedPaths,
    loading,
    error,
    submitError,
    submittedPrompt,
    canSubmit,
    setSelectedPath,
    startComment,
    cancelEditor,
    saveComment,
    deleteComment,
    toggleCollapse,
    closeReview,
    submitReview
  } = useReviewSurfaceState({
    api,
    token,
    closeWithBeacon: !providedApi
  });

  if (loading) {
    return <main className={themedFullscreen}>Loading review...</main>;
  }

  if (error) {
    return (
      <main className={themedFullscreen}>
        <h1 className="m-0 text-2xl font-bold text-red-900 dark:text-review-red">
          Review unavailable
        </h1>
        <p className="mt-1 text-review-light-muted dark:text-review-muted">
          {error}
        </p>
      </main>
    );
  }

  if (!snapshot || snapshot.files.length === 0) {
    return (
      <main className={themedFullscreen}>
        <h1 className="m-0 text-2xl font-bold">No changes to review</h1>
        <p className="mt-1 text-review-light-muted dark:text-review-muted">
          The selected snapshot does not contain reviewable files.
        </p>
      </main>
    );
  }

  if (submittedPrompt) {
    return (
      <main className={themedFullscreen}>
        <h1 className="m-0 text-2xl font-bold">Review submitted</h1>
        <p className="mt-1 text-review-light-muted dark:text-review-muted">
          Your feedback was sent back to Pi.
        </p>
      </main>
    );
  }

  return (
    <div
      className={`grid h-screen grid-cols-[260px_minmax(0,1fr)] overflow-hidden bg-review-light-bg text-review-light-text ${
        isDark ? "dark" : ""
      } dark:bg-review-bg dark:text-review-text max-[800px]:block max-[800px]:h-auto max-[800px]:min-h-screen max-[800px]:overflow-visible`}
      data-testid="review-app-shell"
    >
      <aside className="flex min-w-0 flex-col border-review-light-border border-r bg-review-light-low dark:border-review-border dark:bg-review-low max-[800px]:border-r-0 max-[800px]:border-b">
        <div className="flex h-14 items-center gap-3 px-4">
          <div className="grid size-8 place-items-center rounded bg-review-light-primary font-extrabold text-review-light-surface dark:bg-review-primary dark:text-review-bg">
            pi
          </div>
          <div>
            <h1 className="m-0 text-base font-bold leading-tight">
              Pi Review Mode
            </h1>
            <p className="m-0 text-review-light-muted text-xs dark:text-review-muted">
              Local repository
            </p>
          </div>
        </div>
        <div className="grid gap-1 px-2 py-4">
          <button
            type="button"
            className="min-h-9 border-review-light-primary border-l-2 px-3 py-2 text-left font-extrabold text-review-light-primary dark:border-review-primary dark:text-review-primary"
          >
            Files
          </button>
        </div>
        <FileTree
          files={snapshot.files}
          comments={comments}
          selectedPath={selectedPath}
          collapsedPaths={collapsedPaths}
          onSelect={setSelectedPath}
          onToggleCollapse={toggleCollapse}
        />
      </aside>
      <main className="grid min-w-0 grid-rows-[56px_minmax(0,1fr)_64px] overflow-hidden max-[800px]:block">
        <header className="flex items-center justify-between gap-4 border-review-light-border border-b bg-review-light-bg px-4 dark:border-review-border dark:bg-review-bg max-[800px]:flex-wrap max-[800px]:px-3 max-[800px]:py-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <strong className="text-lg">Pi Review</strong>
              <span className="text-review-light-muted dark:text-review-muted">
                /
              </span>
              <code className="truncate font-mono text-review-light-muted text-xs dark:text-review-muted">
                {snapshot.title ?? "Review changes"}
              </code>
            </div>
            <p className="m-0 text-review-light-muted text-xs dark:text-review-muted">
              {snapshot.stats.filesChanged} files · +{snapshot.stats.additions}{" "}
              -{snapshot.stats.deletions} · {comments.length} saved comments
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="min-h-9 rounded-md border border-review-light-border bg-review-light-surface px-3 font-bold text-review-light-muted hover:border-review-light-primary hover:text-review-light-primary dark:border-review-border dark:bg-review-high dark:text-review-muted dark:hover:border-review-primary dark:hover:text-review-primary"
              aria-pressed={isDark}
              aria-label={isDark ? "Use light mode" : "Use dark mode"}
              onClick={() => setTheme(isDark ? "light" : "dark")}
            >
              {isDark ? "Dark" : "Light"}
            </button>
            <button
              type="button"
              className="min-h-9 rounded-md border border-review-light-primary bg-review-light-primary px-4 font-extrabold text-review-light-surface disabled:cursor-not-allowed disabled:opacity-55 dark:border-review-primary dark:bg-review-primary dark:text-review-bg"
              disabled={!canSubmit}
              onClick={() => void submitReview()}
            >
              Finish Review
            </button>
          </div>
        </header>
        {submitError ? (
          <div className="absolute top-[68px] right-4 z-10 max-w-[420px] rounded-lg border border-review-light-red bg-red-50 px-3 py-2 text-red-900 dark:border-review-red dark:bg-[#93000a] dark:text-[#ffdad6]">
            {submitError}
          </div>
        ) : null}
        <section
          className="min-h-0 overflow-auto bg-review-light-surface p-4 dark:bg-review-surface"
          aria-label="Unified diff"
        >
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
        </section>
        <footer className="flex items-center justify-between gap-4 border-review-light-border border-t bg-review-light-low px-6 dark:border-review-border dark:bg-review-low max-[800px]:flex-wrap max-[800px]:px-3 max-[800px]:py-3">
          <div className="flex items-center gap-4 text-sm font-bold">
            <span>{comments.length} Saved Comments</span>
            <span>{snapshot.files.length} Files Reviewed</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="min-h-8 rounded-md border border-review-light-border px-3 text-review-light-muted hover:border-review-light-primary dark:border-review-border dark:text-review-muted dark:hover:border-review-primary"
              onClick={() => void closeReview()}
            >
              Close
            </button>
            <button
              type="button"
              className="min-h-9 rounded-md border border-review-light-green bg-review-light-green px-4 font-extrabold text-review-light-surface disabled:cursor-not-allowed disabled:opacity-55 dark:border-review-green dark:bg-review-green dark:text-[#003824]"
              disabled={!canSubmit}
              onClick={() => void submitReview()}
            >
              Submit
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
