import type { ReviewFileSnapshot, SavedComment } from "../types";

interface FileTreeProps {
  files: ReviewFileSnapshot[];
  comments: SavedComment[];
  selectedPath: string | null;
  collapsedPaths: Set<string>;
  onSelect: (path: string) => void;
  onToggleCollapse: (path: string) => void;
}

const statusLabels: Record<string, string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  copied: "C",
  binary: "B"
};

export function FileTree({
  files,
  comments,
  selectedPath,
  collapsedPaths,
  onSelect,
  onToggleCollapse
}: FileTreeProps) {
  const counts = comments.reduce<Record<string, number>>((acc, comment) => {
    acc[comment.filePath] = (acc[comment.filePath] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <aside className="file-tree" aria-label="Changed files">
      <div className="file-tree__header">Files</div>
      <nav>
        {files.map((file) => {
          const count = counts[file.path] ?? 0;
          const selected = selectedPath === file.path;
          return (
            <div className="file-tree__row" key={file.path}>
              <button
                type="button"
                className="file-tree__toggle"
                aria-label={`${collapsedPaths.has(file.path) ? "Expand" : "Collapse"} ${file.path}`}
                onClick={() => onToggleCollapse(file.path)}
              >
                {collapsedPaths.has(file.path) ? "+" : "-"}
              </button>
              <button
                type="button"
                className={
                  selected
                    ? "file-tree__item file-tree__item--selected"
                    : "file-tree__item"
                }
                onClick={() => onSelect(file.path)}
              >
                <span
                  className={`file-tree__status file-tree__status--${file.status}`}
                >
                  {statusLabels[file.status] ?? "M"}
                </span>
                <span className="file-tree__path" title={file.path}>
                  {file.path}
                </span>
                <span className="file-tree__stats">
                  +{file.additions} -{file.deletions}
                </span>
                {count > 0 ? (
                  <span
                    className="file-tree__comments"
                    title={`${count} comments`}
                  >
                    <span aria-hidden="true">{count}</span>
                    <span className="sr-only">{count} comments</span>
                  </span>
                ) : null}
              </button>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
