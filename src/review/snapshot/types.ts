import type { ReviewScope } from "../source/scope.types.js";

export interface ReviewDiffStats {
  readonly filesChanged: number;
  readonly additions: number;
  readonly deletions: number;
  readonly changedLines: number;
}

export interface ReviewSnapshot {
  readonly id: string;
  readonly createdAt: string;
  readonly repoRoot: string;
  readonly scope: ReviewScope;
  readonly baseRef?: string;
  readonly headRef: string;
  readonly diff: string;
  readonly files: readonly ReviewFileSnapshot[];
  readonly stats: ReviewDiffStats;
  readonly warnings: readonly string[];
}

export type ReviewFileStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "binary"
  | "unknown";

export interface ReviewFileSnapshot {
  readonly anchor: ReviewAnchor;
  readonly status: ReviewFileStatus;
  readonly path: string;
  readonly oldPath?: string;
  readonly metadata: readonly string[];
  readonly patch: string;
  readonly additions: number;
  readonly deletions: number;
  readonly binary: boolean;
  readonly hunks: readonly ReviewDiffHunk[];
}

export interface ReviewDiffHunk {
  readonly index: number;
  readonly header: string;
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly rows: readonly ReviewDiffRow[];
}

export type ReviewDiffRowKind = "context" | "add" | "delete";
export type ReviewAnchorSide = "file" | "old" | "new";

export interface ReviewDiffRow {
  readonly anchor: ReviewAnchor;
  readonly kind: ReviewDiffRowKind;
  readonly text: string;
  readonly oldLineNumber?: number;
  readonly newLineNumber?: number;
  readonly rowIndex: number;
}

export interface ReviewAnchor {
  readonly id: string;
  readonly path: string;
  readonly oldPath?: string;
  readonly side: ReviewAnchorSide;
  readonly hunkIndex?: number;
  readonly hunkHeader?: string;
  readonly oldLineNumber?: number;
  readonly newLineNumber?: number;
  readonly rowIndex?: number;
  readonly lineText?: string;
}
