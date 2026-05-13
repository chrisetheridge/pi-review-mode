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

const statusClasses: Record<string, string> = {
  added: "bg-[#d9f7e8] text-[#0b6b3a]",
  deleted: "bg-[#ffe3e3] text-[#a61b1b]",
  renamed: "bg-[#fff0c2] text-[#8a5d00]",
  copied: "bg-[#e8f2ff] text-[#334e68]",
  binary:
    "bg-review-light-high text-review-light-text dark:bg-review-high dark:text-review-text",
  modified: "bg-[#eef2f6] text-[#334e68]"
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
    <nav className="min-h-0 overflow-auto px-2 py-4" aria-label="Changed files">
      <h2 className="m-0 px-1 pb-3 font-mono text-review-light-outline text-[0.68rem] uppercase tracking-[0.05em] dark:text-review-outline">
        Changed files
      </h2>
      <div className="grid gap-1">
        {files.map((file) => {
          const count = counts[file.path] ?? 0;
          const selected = selectedPath === file.path;
          return (
            <div
              className="grid grid-cols-[28px_minmax(0,1fr)]"
              key={file.path}
            >
              <button
                type="button"
                className="text-review-light-muted hover:text-review-light-primary dark:text-review-muted dark:hover:text-review-primary"
                aria-label={`${collapsedPaths.has(file.path) ? "Expand" : "Collapse"} ${file.path}`}
                onClick={() => onToggleCollapse(file.path)}
              >
                {collapsedPaths.has(file.path) ? "+" : "-"}
              </button>
              <button
                type="button"
                className={`grid min-h-8 w-full grid-cols-[22px_minmax(0,1fr)_auto_auto] items-center gap-2 border-l-2 px-2 py-1.5 text-left ${
                  selected
                    ? "border-review-light-primary text-review-light-primary dark:border-review-primary dark:text-review-primary"
                    : "border-transparent text-review-light-muted hover:bg-review-light-high dark:text-review-muted dark:hover:bg-review-high"
                }`}
                aria-current={selected ? "true" : undefined}
                aria-label={`${selected ? "Selected " : ""}${file.path}`}
                onClick={() => onSelect(file.path)}
              >
                <span
                  className={`inline-flex h-[22px] min-w-[22px] items-center justify-center rounded font-extrabold text-xs ${
                    statusClasses[file.status] ?? statusClasses.modified
                  }`}
                >
                  {statusLabels[file.status] ?? "M"}
                </span>
                <span className="truncate" title={file.path}>
                  {file.path}
                </span>
                <span className="font-mono text-review-light-outline text-xs dark:text-review-outline">
                  +{file.additions} -{file.deletions}
                </span>
                {count > 0 ? (
                  <span
                    className="min-w-[22px] rounded-full bg-review-light-primary text-center font-bold text-review-light-surface text-xs leading-[22px] dark:bg-[#334e68] dark:text-white"
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
      </div>
    </nav>
  );
}
