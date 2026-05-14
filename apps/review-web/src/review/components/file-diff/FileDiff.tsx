import { DiffModeEnum, DiffView, SplitSide } from "@git-diff-view/react";
import "@git-diff-view/react/styles/diff-view-pure.css";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DiffAnchor, ReviewFileSnapshot, SavedComment } from "../../model";
import { CommentEditor } from "../CommentEditor";
import { SavedCommentCard } from "../SavedCommentCard";
import {
  addExtendItem,
  buildAnchorIndex,
  type ExtendData,
  type ExtendItem,
  estimateFileDiffHeight,
  fallbackPatch,
  findAnchorById
} from "./data";
import { FileDiffHeader } from "./Header";

interface ActiveEditor {
  anchor: DiffAnchor;
}

interface FileDiffProps {
  file: ReviewFileSnapshot;
  collapsed: boolean;
  comments: SavedComment[];
  activeEditors: ActiveEditor[];
  viewed: boolean;
  onToggleViewed: (path: string) => void;
  onToggleCollapse: (path: string) => void;
  onStartComment: (anchor: DiffAnchor) => void;
  onCancelEditor: (anchorId: string) => void;
  onSaveComment: (anchor: DiffAnchor, body: string) => Promise<void> | void;
  onDeleteComment: (anchorId: string) => Promise<void> | void;
  theme?: "light" | "dark";
  virtualizeBody?: boolean;
}

export function fileDiffDomId(path: string) {
  return `review-file-${encodeURIComponent(path)}`;
}

export const FileDiff = memo(function FileDiff({
  file,
  collapsed,
  comments,
  activeEditors,
  viewed,
  onToggleViewed,
  onToggleCollapse,
  onStartComment,
  onCancelEditor,
  onSaveComment,
  onDeleteComment,
  theme = "dark",
  virtualizeBody = false
}: FileDiffProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [nearViewport, setNearViewport] = useState(!virtualizeBody);
  const [reservedHeight, setReservedHeight] = useState(() =>
    estimateFileDiffHeight(file)
  );
  const shouldRenderBody =
    !collapsed &&
    (!virtualizeBody ||
      nearViewport ||
      comments.length > 0 ||
      activeEditors.length > 0);

  useEffect(() => {
    if (!virtualizeBody) {
      setNearViewport(true);
      return;
    }
    const element = sectionRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setNearViewport(entry.isIntersecting),
      { root: null, rootMargin: "900px 0px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [virtualizeBody]);

  useEffect(() => {
    if (!shouldRenderBody) return;
    const element = sectionRef.current;
    if (!element) return;
    const updateHeight = () => {
      const height = element.offsetHeight;
      if (height > 0) setReservedHeight(height);
    };
    updateHeight();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [shouldRenderBody]);

  const commentsByAnchor = useMemo(
    () =>
      comments.reduce<Record<string, SavedComment[]>>((acc, comment) => {
        acc[comment.anchorId] = [...(acc[comment.anchorId] ?? []), comment];
        return acc;
      }, {}),
    [comments]
  );
  const editorsByAnchor = useMemo(
    () =>
      activeEditors.reduce<Record<string, ActiveEditor>>((acc, editor) => {
        acc[editor.anchor.id] = editor;
        return acc;
      }, {}),
    [activeEditors]
  );

  const anchorIndex = useMemo(() => buildAnchorIndex(file), [file]);
  const diffData = useMemo(
    () => ({
      oldFile: { fileName: file.oldPath ?? file.path, content: "" },
      newFile: { fileName: file.path, content: "" },
      hunks: [file.patch ?? fallbackPatch(file)]
    }),
    [file]
  );
  const extendData = useMemo<ExtendData>(() => {
    const data: ExtendData = { oldFile: {}, newFile: {} };
    for (const comment of comments) {
      const anchor = findAnchorById(file, comment.anchorId);
      if (anchor)
        addExtendItem(data, anchor, { type: "comment", comment, anchor });
    }
    for (const editor of activeEditors) {
      addExtendItem(data, editor.anchor, {
        type: "editor",
        anchor: editor.anchor
      });
    }
    return data;
  }, [file, comments, activeEditors]);

  const findLineAnchor = useCallback(
    (lineNumber: number, side: SplitSide) =>
      side === SplitSide.old
        ? anchorIndex.old.get(lineNumber)
        : anchorIndex.new.get(lineNumber),
    [anchorIndex]
  );

  const handleAddWidgetClick = useCallback(
    (lineNumber: number, side: SplitSide) => {
      const anchor = findLineAnchor(lineNumber, side);
      if (anchor) onStartComment(anchor);
    },
    [findLineAnchor, onStartComment]
  );

  const renderExtendLine = useCallback(
    ({ data }: { data?: ExtendItem[] }) => {
      if (!data?.length) return null;
      return (
        <div className="border-border border-y bg-card px-4 py-2">
          {data.map((item) =>
            item.type === "comment" ? (
              <SavedCommentCard
                key={item.comment.id}
                comment={item.comment}
                anchor={item.anchor}
                onDelete={onDeleteComment}
                onSave={onSaveComment}
              />
            ) : (
              <CommentEditor
                key={`editor-${item.anchor.id}`}
                onCancel={() => onCancelEditor(item.anchor.id)}
                onSave={(body) => onSaveComment(item.anchor, body)}
              />
            )
          )}
        </div>
      );
    },
    [onCancelEditor, onDeleteComment, onSaveComment]
  );

  function renderCommentSurface(anchor: DiffAnchor) {
    const saved = commentsByAnchor[anchor.id] ?? [];
    const editor = editorsByAnchor[anchor.id];
    return (
      <div className="ml-[140px] max-[800px]:ml-0 max-[800px]:pl-3">
        {saved.map((comment) => (
          <SavedCommentCard
            key={comment.id}
            comment={comment}
            anchor={anchor}
            onDelete={onDeleteComment}
            onSave={onSaveComment}
          />
        ))}
        {editor ? (
          <CommentEditor
            onCancel={() => onCancelEditor(anchor.id)}
            onSave={(body) => onSaveComment(anchor, body)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <section
      ref={sectionRef}
      id={fileDiffDomId(file.path)}
      className="mb-4 overflow-hidden border border-border bg-card text-card-foreground shadow-xs rounded-md"
      style={
        virtualizeBody && !collapsed && !shouldRenderBody
          ? { minHeight: reservedHeight }
          : undefined
      }
      aria-label={`Diff for ${file.path}`}
    >
      <FileDiffHeader
        file={file}
        collapsed={collapsed}
        viewed={viewed}
        onToggleViewed={onToggleViewed}
        onToggleCollapse={onToggleCollapse}
        onStartComment={onStartComment}
      />
      {shouldRenderBody ? (
        <div>
          {renderCommentSurface(file.fileAnchor)}
          {file.binary ? (
            <div className="px-3.5 py-5 text-muted-foreground">
              Binary file. Line comments are unavailable.
            </div>
          ) : (
            <div
              className="review-diff-view"
              data-testid={`diff-view-${file.path}`}
            >
              <DiffView<ExtendItem[]>
                data={diffData}
                diffViewMode={DiffModeEnum.Unified}
                diffViewTheme={theme}
                diffViewHighlight
                diffViewWrap={false}
                diffViewAddWidget
                extendData={extendData}
                onAddWidgetClick={handleAddWidgetClick}
                renderExtendLine={renderExtendLine}
              />
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
});
