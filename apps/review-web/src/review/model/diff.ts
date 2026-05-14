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
