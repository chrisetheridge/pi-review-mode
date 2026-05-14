import type { DiffAnchor, DiffHunk } from "./diff";

export type ReviewFileStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "binary";

export interface ReviewFileSnapshot {
  path: string;
  oldPath?: string;
  status: ReviewFileStatus;
  additions: number;
  deletions: number;
  binary: boolean;
  patch?: string;
  hunks: DiffHunk[];
  fileAnchor: DiffAnchor;
}

export interface ReviewDiffStats {
  filesChanged: number;
  additions: number;
  deletions: number;
}

export interface ReviewSnapshot {
  id: string;
  title?: string;
  baseRef?: string;
  headRef?: string;
  stats: ReviewDiffStats;
  files: ReviewFileSnapshot[];
}
