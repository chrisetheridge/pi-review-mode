import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  ListFilter,
  Search
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ReviewFileSnapshot, SavedComment } from "../types";

interface FileTreeProps {
  files: ReviewFileSnapshot[];
  comments: SavedComment[];
  selectedPath: string | null;
  collapsedPaths: Set<string>;
  onSelect: (path: string) => void;
  onToggleCollapse: (path: string) => void;
}

interface DirectoryNode {
  type: "directory";
  name: string;
  path: string;
  children: TreeNode[];
}

interface FileNode {
  type: "file";
  name: string;
  path: string;
  file: ReviewFileSnapshot;
}

type TreeNode = DirectoryNode | FileNode;

const statusLabels: Record<string, string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  copied: "C",
  binary: "B"
};

const statusClasses: Record<string, string> = {
  added:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  deleted: "border-destructive/20 bg-destructive/10 text-destructive",
  renamed:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
  copied: "border-primary/20 bg-primary/10 text-primary",
  binary: "border-border bg-muted text-muted-foreground",
  modified: "border-border bg-secondary text-secondary-foreground"
};

function buildTree(files: ReviewFileSnapshot[]) {
  const root: DirectoryNode = {
    type: "directory",
    name: "",
    path: "",
    children: []
  };

  for (const file of files) {
    const parts = file.path.split("/");
    let directory = root;

    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join("/");
      const isFile = index === parts.length - 1;

      if (isFile) {
        directory.children.push({ type: "file", name: part, path, file });
        return;
      }

      let child = directory.children.find(
        (node): node is DirectoryNode =>
          node.type === "directory" && node.name === part
      );
      if (!child) {
        child = { type: "directory", name: part, path, children: [] };
        directory.children.push(child);
      }
      directory = child;
    });
  }

  return root.children;
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
  return [...nodes]
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .map((node) =>
      node.type === "directory"
        ? { ...node, children: sortTree(node.children) }
        : node
    );
}

const DEPTH_PADDING = 10;

export function FileTree({
  files,
  comments,
  selectedPath,
  collapsedPaths,
  onSelect,
  onToggleCollapse
}: FileTreeProps) {
  const [query, setQuery] = useState("");
  const [collapsedDirectories, setCollapsedDirectories] = useState<Set<string>>(
    () => new Set()
  );
  const filterInputId = useId();
  const normalizedQuery = query.trim().toLowerCase();
  const counts = comments.reduce<Record<string, number>>((acc, comment) => {
    acc[comment.filePath] = (acc[comment.filePath] ?? 0) + 1;
    return acc;
  }, {});
  const visibleFiles = normalizedQuery
    ? files.filter((file) => file.path.toLowerCase().includes(normalizedQuery))
    : files;
  const tree = useMemo(() => sortTree(buildTree(visibleFiles)), [visibleFiles]);

  function toggleDirectory(path: string) {
    setCollapsedDirectories((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function renderNode(node: TreeNode, depth: number): React.ReactNode {
    if (node.type === "directory") {
      const collapsed = collapsedDirectories.has(node.path);
      return (
        <div key={node.path}>
          <div
            role="treeitem"
            tabIndex={-1}
            aria-label={node.name}
            aria-expanded={!collapsed}
            className="flex h-8 items-center gap-1.5 px-2 font-medium text-foreground text-sm"
            style={{ paddingLeft: `${8 + depth * DEPTH_PADDING}px` }}
          >
            <Button
              type="button"
              variant="ghost"
              className="h-7 min-w-0 flex-1 justify-start gap-1.5 px-0.5 text-left"
              aria-label={`${collapsed ? "Expand" : "Collapse"} ${node.path} folder`}
              onClick={() => toggleDirectory(node.path)}
            >
              <span
                className="text-muted-foreground text-xs"
                aria-hidden="true"
              >
                {collapsed ? (
                  <ChevronRight className="size-3.5" strokeWidth={2.25} />
                ) : (
                  <ChevronDown className="size-3.5" strokeWidth={2.25} />
                )}
              </span>
              <Folder
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
                strokeWidth={2}
              />
              <span className="truncate">{node.name}</span>
            </Button>
          </div>
          {collapsed ? null : (
            <div>
              {node.children.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    const file = node.file;
    const count = counts[file.path] ?? 0;
    const selected = selectedPath === file.path;
    const collapsed = collapsedPaths.has(file.path);

    return (
      <div
        className="grid grid-cols-[24px_minmax(0,1fr)] items-center"
        key={file.path}
        style={{ paddingLeft: `${8 + depth * DEPTH_PADDING}px` }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${file.path}`}
          onClick={() => onToggleCollapse(file.path)}
        ></Button>
        <Button
          type="button"
          variant={selected ? "secondary" : "ghost"}
          className="grid min-h-8 w-full grid-cols-[18px_minmax(0,1fr)_auto_auto] justify-normal gap-2 px-2 py-1 text-left text-sm"
          aria-current={selected ? "true" : undefined}
          aria-label={`${selected ? "Selected " : ""}${file.path}`}
          onClick={() => onSelect(file.path)}
        >
          <span aria-hidden="true" className="text-muted-foreground">
            <File className="size-4" strokeWidth={1.9} />
          </span>
          <span className="truncate" title={file.path}>
            {node.name}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "h-5 min-w-5 px-1 font-bold text-[0.65rem]",
              statusClasses[file.status] ?? statusClasses.modified
            )}
          >
            {statusLabels[file.status] ?? "M"}
          </Badge>
          <span className="whitespace-nowrap font-mono text-[0.68rem] text-muted-foreground">
            <span className="sr-only">
              +{file.additions} -{file.deletions}
            </span>
            <span aria-hidden="true" className="text-[#1a7f37]">
              +{file.additions}
            </span>{" "}
            <span aria-hidden="true" className="text-[#cf222e]">
              -{file.deletions}
            </span>
          </span>
          {count > 0 ? (
            <Badge
              className="col-start-4 min-w-5 px-1.5 text-center font-bold text-[0.65rem] leading-5"
              title={`${count} comments`}
            >
              <span aria-hidden="true">{count}</span>
              <span className="sr-only">{count} comments</span>
            </Badge>
          ) : null}
        </Button>
      </div>
    );
  }

  return (
    <nav className="min-h-0 overflow-auto p-3" aria-label="Changed files">
      <div className="mb-4 flex items-center gap-2">
        <label className="relative min-w-0 flex-1" htmlFor={filterInputId}>
          <span className="sr-only">Filter files</span>
          <span
            aria-hidden="true"
            className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          >
            <Search className="size-4" strokeWidth={2} />
          </span>
          <Input
            id={filterInputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter files..."
            className="h-9 bg-background pr-3 pl-8"
          />
        </label>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="Filter settings"
        >
          <ListFilter aria-hidden="true" className="size-4" strokeWidth={2} />
        </Button>
      </div>
      <div className="mb-2 flex items-center justify-between px-1 text-muted-foreground text-xs">
        <h2 className="m-0 font-semibold uppercase tracking-[0.04em]">
          Changed files
        </h2>
        <span>{visibleFiles.length}</span>
      </div>
      <div className="grid gap-0.5" role="tree" aria-label="Changed file tree">
        {tree.map((node) => renderNode(node, 0))}
      </div>
    </nav>
  );
}
