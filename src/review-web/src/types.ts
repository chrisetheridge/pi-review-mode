export type ReviewFileStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "binary";

export type DiffRowType = "context" | "add" | "delete";

export interface DiffAnchor {
  id: string;
  filePath: string;
  side: "old" | "new" | "file";
  hunkIndex?: number;
  hunkHeader?: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  rowIndex?: number;
  lineText?: string;
}

export interface DiffRow {
  type: DiffRowType;
  oldLineNumber?: number;
  newLineNumber?: number;
  text: string;
  anchor: DiffAnchor;
}

export interface DiffHunk {
  header: string;
  rows: DiffRow[];
}

export interface ReviewFileSnapshot {
  path: string;
  oldPath?: string;
  status: ReviewFileStatus;
  additions: number;
  deletions: number;
  binary: boolean;
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

export interface SavedComment {
  id: string;
  anchorId: string;
  filePath: string;
  body: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SaveCommentRequest {
  anchor: DiffAnchor;
  body: string;
}

export interface SubmitResponse {
  prompt: string;
}
