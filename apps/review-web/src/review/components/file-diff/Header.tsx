import {
  CheckSquare,
  ChevronDown,
  ChevronUp,
  MessageSquareMore,
  Square
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DiffAnchor, ReviewFileSnapshot } from "../../model";

interface FileDiffHeaderProps {
  file: ReviewFileSnapshot;
  collapsed: boolean;
  viewed: boolean;
  onToggleViewed: (path: string) => void;
  onToggleCollapse: (path: string) => void;
  onStartComment: (anchor: DiffAnchor) => void;
}

export function FileDiffHeader({
  file,
  collapsed,
  viewed,
  onToggleViewed,
  onToggleCollapse,
  onStartComment
}: FileDiffHeaderProps) {
  return (
    <header className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 border-border border-b bg-muted/50 px-3.5 py-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`${collapsed ? "Expand" : "Collapse"} ${file.path}`}
        onClick={() => onToggleCollapse(file.path)}
      >
        {collapsed ? (
          <ChevronUp aria-hidden="true" className="size-4" />
        ) : (
          <ChevronDown aria-hidden="true" className="size-4" />
        )}
      </Button>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="m-0 truncate font-mono text-sm">{file.path}</h2>
        </div>
        {file.oldPath && file.oldPath !== file.path ? (
          <p className="mt-1 text-muted-foreground text-xs">
            Renamed from {file.oldPath}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Badge
          variant="ghost"
          className="font-mono text-xs text-muted-foreground"
        >
          <span className="sr-only">
            +{file.additions} -{file.deletions}
          </span>
          <span aria-hidden="true" className="font-semibold text-[#1a7f37]">
            +{file.additions}
          </span>{" "}
          <span aria-hidden="true" className="font-semibold text-[#cf222e]">
            -{file.deletions}
          </span>
        </Badge>
        <label
          className={cn(
            "inline-flex min-h-8 items-center gap-1 border px-2.5 text-sm transition-colors hover:bg-muted rounded-md",
            viewed
              ? "border-primary/20 bg-primary/10 text-primary"
              : "border-border bg-background text-muted-foreground"
          )}
        >
          <input
            type="checkbox"
            className="sr-only"
            checked={viewed}
            aria-label={`Viewed ${file.path}`}
            onChange={() => onToggleViewed(file.path)}
          />
          {viewed ? (
            <CheckSquare aria-hidden="true" className="size-4" />
          ) : (
            <Square aria-hidden="true" className="size-4" />
          )}
          Viewed
        </label>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Add file comment"
          onClick={() => onStartComment(file.fileAnchor)}
        >
          <MessageSquareMore aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </header>
  );
}
