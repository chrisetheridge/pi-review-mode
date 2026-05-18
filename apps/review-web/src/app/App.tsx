import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FileDiff, fileDiffDomId } from "../review/components/FileDiff";
import { FileTree } from "../review/components/FileTree";
import type { AgentReviewTag, DiffAnchor, SavedComment } from "../review/model";
import { useReviewSurfaceState } from "../review/state/useReviewState";
import { createGlimpseReviewTransport } from "../review/transport/glimpse";
import type { ReviewTransport } from "../review/transport/types";
import { groupByFilePath } from "./group-by-file";
import { readInitialTheme, storeTheme, type Theme } from "./theme";

interface AppProps {
  transport?: ReviewTransport;
}

const EMPTY_COMMENTS: SavedComment[] = [];
const EMPTY_EDITORS: { anchor: DiffAnchor }[] = [];
const AGENT_REVIEW_TAGS: AgentReviewTag[] = ["spec", "standards", "bug"];

export function App({ transport: providedTransport }: AppProps) {
  const transport = useMemo(
    () => providedTransport ?? createGlimpseReviewTransport(),
    [providedTransport]
  );
  const [theme, setTheme] = useState<Theme>(readInitialTheme);
  const [viewedPaths, setViewedPaths] = useState<Set<string>>(() => new Set());
  const [selectedTagFilters, setSelectedTagFilters] = useState<
    Set<AgentReviewTag>
  >(() => new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isDark = theme === "dark";

  useEffect(() => {
    storeTheme(theme);
  }, [theme]);

  const themedFullscreen = `grid min-h-screen place-content-center bg-background p-6 text-center text-foreground ${
    isDark ? "dark" : ""
  }`;

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
    collapsePath,
    expandPath,
    closeReview,
    submitReview
  } = useReviewSurfaceState({
    transport
  });

  const toggleViewed = useCallback(
    (path: string) => {
      setViewedPaths((current) => {
        const next = new Set(current);
        if (next.has(path)) {
          next.delete(path);
          expandPath(path);
        } else {
          next.add(path);
          collapsePath(path);
        }
        return next;
      });
    },
    [collapsePath, expandPath]
  );

  const hasTaggedComments = useMemo(
    () => comments.some((comment) => (comment.tags?.length ?? 0) > 0),
    [comments]
  );
  const visibleComments = useMemo(() => {
    if (!hasTaggedComments || selectedTagFilters.size === 0) return comments;
    return comments.filter((comment) =>
      comment.tags?.some((tag) => selectedTagFilters.has(tag))
    );
  }, [comments, hasTaggedComments, selectedTagFilters]);
  const commentsByFile = useMemo(
    () => groupByFilePath(visibleComments, (comment) => comment.filePath),
    [visibleComments]
  );
  const activeEditorsByFile = useMemo(
    () => groupByFilePath(activeEditors, (editor) => editor.anchor.filePath),
    [activeEditors]
  );

  const selectFile = useCallback(
    (path: string) => {
      setSelectedPath(path);
      expandPath(path);
      document
        .getElementById(fileDiffDomId(path))
        ?.scrollIntoView({ block: "start" });
    },
    [expandPath, setSelectedPath]
  );

  const toggleTagFilter = useCallback((tag: AgentReviewTag) => {
    setSelectedTagFilters((current) => {
      const next = new Set(current);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }, []);

  if (loading) {
    return <main className={themedFullscreen}>Loading review...</main>;
  }

  if (error) {
    return (
      <main className={themedFullscreen}>
        <h1 className="m-0 text-2xl font-bold text-destructive">
          Review unavailable
        </h1>
        <p className="mt-1 text-muted-foreground">{error}</p>
      </main>
    );
  }

  if (!snapshot || snapshot.files.length === 0) {
    return (
      <main className={themedFullscreen}>
        <h1 className="m-0 text-2xl font-bold">No changes to review</h1>
        <p className="mt-1 text-muted-foreground">
          The selected snapshot does not contain reviewable files.
        </p>
      </main>
    );
  }

  if (submittedPrompt) {
    return (
      <main className={themedFullscreen}>
        <h1 className="m-0 text-2xl font-bold">Review submitted</h1>
        <p className="mt-1 text-muted-foreground">
          Your feedback was sent back to Pi.
        </p>
      </main>
    );
  }

  return (
    <div
      className={`grid h-screen overflow-hidden bg-background text-foreground transition-[grid-template-columns] duration-200 ${
        sidebarCollapsed
          ? "grid-cols-[57px_minmax(0,1fr)]"
          : "grid-cols-[300px_minmax(0,1fr)]"
      } ${
        isDark ? "dark" : ""
      } max-[800px]:block max-[800px]:h-auto max-[800px]:min-h-screen max-[800px]:overflow-visible`}
      data-testid="review-app-shell"
    >
      <aside className="flex min-w-0 flex-col border-border border-r bg-sidebar text-sidebar-foreground max-[800px]:border-r-0 max-[800px]:border-b">
        <FileTree
          files={snapshot.files}
          comments={comments}
          selectedPath={selectedPath}
          collapsedPaths={collapsedPaths}
          sidebarCollapsed={sidebarCollapsed}
          onSelect={selectFile}
          onToggleCollapse={toggleCollapse}
          onToggleSidebar={() => setSidebarCollapsed((collapsed) => !collapsed)}
        />
      </aside>
      <main className="grid min-w-0 grid-rows-[56px_minmax(0,1fr)_56px] overflow-hidden max-[800px]:block">
        <header className="flex items-center justify-between gap-4 border-border border-b bg-card px-4 max-[800px]:flex-wrap max-[800px]:px-3 max-[800px]:py-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <strong className="text-sm font-semibold">Review changes</strong>
              <span className="text-muted-foreground">/</span>
              <code className="truncate font-mono text-muted-foreground text-xs">
                {snapshot.title ?? "Local snapshot"}
              </code>
            </div>
            <p className="m-0 text-muted-foreground text-xs">
              {snapshot.stats.filesChanged} files · +{snapshot.stats.additions}{" "}
              -{snapshot.stats.deletions} · {comments.length} saved comments
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {hasTaggedComments ? (
              <fieldset
                aria-label="Tag filters"
                className="flex flex-wrap items-center gap-1.5"
              >
                {AGENT_REVIEW_TAGS.map((tag) => (
                  <Button
                    key={tag}
                    type="button"
                    variant={
                      selectedTagFilters.has(tag) ? "secondary" : "outline"
                    }
                    aria-pressed={selectedTagFilters.has(tag)}
                    aria-label={`Filter ${tag}`}
                    onClick={() => toggleTagFilter(tag)}
                  >
                    {tag}
                  </Button>
                ))}
                {selectedTagFilters.size > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Clear tag filters"
                    onClick={() => setSelectedTagFilters(new Set())}
                  >
                    Clear
                  </Button>
                ) : null}
              </fieldset>
            ) : null}
            <Button
              type="button"
              variant="outline"
              aria-pressed={isDark}
              aria-label={isDark ? "Use light mode" : "Use dark mode"}
              onClick={() => setTheme(isDark ? "light" : "dark")}
            >
              {isDark ? "Dark" : "Light"}
            </Button>
            <Button
              type="button"
              disabled={!canSubmit}
              onClick={() => void submitReview()}
            >
              Finish Review
            </Button>
          </div>
        </header>
        {submitError ? (
          <Alert
            variant="destructive"
            className="absolute top-[68px] right-4 z-10 max-w-[420px]"
          >
            <AlertTitle>Submit failed</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}
        <section
          className="min-h-0 overflow-auto bg-background p-4"
          aria-label="Unified diff"
        >
          {snapshot.files.map((file) => (
            <FileDiff
              key={file.path}
              file={file}
              collapsed={collapsedPaths.has(file.path)}
              comments={commentsByFile.get(file.path) ?? EMPTY_COMMENTS}
              activeEditors={
                activeEditorsByFile.get(file.path) ?? EMPTY_EDITORS
              }
              viewed={viewedPaths.has(file.path)}
              onToggleViewed={toggleViewed}
              onToggleCollapse={toggleCollapse}
              onStartComment={startComment}
              onCancelEditor={cancelEditor}
              onSaveComment={saveComment}
              onDeleteComment={deleteComment}
              theme={theme}
              virtualizeBody
            />
          ))}
        </section>
        <footer className="flex items-center justify-between gap-4 border-border border-t bg-card px-4 max-[800px]:flex-wrap max-[800px]:px-3 max-[800px]:py-3">
          <div className="flex items-center gap-4 text-muted-foreground text-sm">
            <span>{comments.length} saved comments</span>
            <span>{snapshot.files.length} files</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void closeReview()}
            >
              Close
            </Button>
            <Button
              type="button"
              disabled={!canSubmit}
              onClick={() => void submitReview()}
            >
              Submit
            </Button>
          </div>
        </footer>
      </main>
    </div>
  );
}
