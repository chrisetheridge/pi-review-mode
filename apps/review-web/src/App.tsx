import { useMemo } from "react";
import { createReviewApi, type ReviewApi, readTokenFromLocation } from "./api";
import { FileDiff } from "./components/FileDiff";
import { FileTree } from "./components/FileTree";
import { useReviewSurfaceState } from "./use-review-surface-state";

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
    return (
      <main className="grid min-h-screen place-content-center p-6 text-center">
        Loading review...
      </main>
    );
  }

  if (error) {
    return (
      <main className="grid min-h-screen place-content-center p-6 text-center text-red-900">
        <h1 className="m-0 text-2xl font-bold">Review unavailable</h1>
        <p className="mt-1 text-slate-500">{error}</p>
      </main>
    );
  }

  if (!snapshot || snapshot.files.length === 0) {
    return (
      <main className="grid min-h-screen place-content-center p-6 text-center">
        <h1 className="m-0 text-2xl font-bold">No changes to review</h1>
        <p className="mt-1 text-slate-500">
          The selected snapshot does not contain reviewable files.
        </p>
      </main>
    );
  }

  if (submittedPrompt) {
    return (
      <main className="grid min-h-screen place-content-center p-6 text-center">
        <h1 className="m-0 text-2xl font-bold">Review submitted</h1>
        <p className="mt-1 text-slate-500">
          Your feedback was sent back to Pi.
        </p>
      </main>
    );
  }

  return (
    <div className="grid h-screen grid-cols-[260px_minmax(0,1fr)] overflow-hidden bg-[#081425] text-[#d8e3fb] max-[800px]:block max-[800px]:h-auto max-[800px]:min-h-screen max-[800px]:overflow-visible">
      <aside className="flex min-w-0 flex-col border-[#424754] border-r bg-[#111c2d] max-[800px]:border-r-0 max-[800px]:border-b">
        <div className="flex h-14 items-center gap-3 px-4">
          <div className="grid size-8 place-items-center rounded bg-[#adc6ff] font-extrabold text-[#002e6a]">
            pi
          </div>
          <div>
            <h1 className="m-0 text-base font-bold leading-tight">
              Pi Review Mode
            </h1>
            <p className="m-0 text-[#c2c6d6] text-xs">Local repository</p>
          </div>
        </div>
        <div className="grid gap-1 px-2 py-4">
          <button
            type="button"
            className="min-h-9 border-[#adc6ff] border-l-2 px-3 py-2 text-left font-extrabold text-[#adc6ff]"
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
        <header className="flex items-center justify-between gap-4 border-[#424754] border-b bg-[#081425] px-4 max-[800px]:flex-wrap max-[800px]:px-3 max-[800px]:py-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <strong className="text-lg">Pi Review</strong>
              <span className="text-[#c2c6d6]">/</span>
              <code className="truncate font-mono text-[#c2c6d6] text-xs">
                {snapshot.title ?? "Review changes"}
              </code>
            </div>
            <p className="m-0 text-[#c2c6d6] text-xs">
              {snapshot.stats.filesChanged} files · +{snapshot.stats.additions}{" "}
              -{snapshot.stats.deletions} · {comments.length} saved comments
            </p>
          </div>
          <button
            type="button"
            className="min-h-9 rounded-md border border-[#adc6ff] bg-[#adc6ff] px-4 font-extrabold text-[#002e6a] disabled:cursor-not-allowed disabled:opacity-55"
            disabled={!canSubmit}
            onClick={() => void submitReview()}
          >
            Finish Review
          </button>
        </header>
        {submitError ? (
          <div className="absolute top-[68px] right-4 z-10 max-w-[420px] rounded-lg border border-[#ffb4ab] bg-[#93000a] px-3 py-2 text-[#ffdad6]">
            {submitError}
          </div>
        ) : null}
        <section
          className="min-h-0 overflow-auto bg-[#152031] p-4"
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
        <footer className="flex items-center justify-between gap-4 border-[#424754] border-t bg-[#111c2d] px-6 max-[800px]:flex-wrap max-[800px]:px-3 max-[800px]:py-3">
          <div className="flex items-center gap-4 text-sm font-bold">
            <span>{comments.length} Saved Comments</span>
            <span>{snapshot.files.length} Files Reviewed</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="min-h-8 rounded-md border border-[#424754] px-3 text-[#c2c6d6]"
              onClick={() => void closeReview()}
            >
              Close
            </button>
            <button
              type="button"
              className="min-h-9 rounded-md border border-[#4edea3] bg-[#4edea3] px-4 font-extrabold text-[#003824] disabled:cursor-not-allowed disabled:opacity-55"
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
