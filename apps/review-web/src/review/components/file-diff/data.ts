import type { DiffAnchor, ReviewFileSnapshot, SavedComment } from "../../model";

export type ExtendItem =
  | { type: "comment"; comment: SavedComment; anchor: DiffAnchor }
  | { type: "editor"; anchor: DiffAnchor };

export type ExtendData = {
  oldFile?: Record<string, { data: ExtendItem[] }>;
  newFile?: Record<string, { data: ExtendItem[] }>;
};

function sideKey(side: "old" | "new") {
  return side === "old" ? "oldFile" : "newFile";
}

export function addExtendItem(
  extendData: ExtendData,
  anchor: DiffAnchor,
  item: ExtendItem
) {
  if (anchor.side !== "old" && anchor.side !== "new") return;
  const lineNumber =
    anchor.side === "old" ? anchor.oldLineNumber : anchor.newLineNumber;
  if (lineNumber == null) return;
  const key = sideKey(anchor.side);
  extendData[key] ??= {};
  const lineKey = String(lineNumber);
  const existing = extendData[key]?.[lineKey]?.data ?? [];
  extendData[key] = {
    ...extendData[key],
    [lineKey]: { data: [...existing, item] }
  };
}

export function buildAnchorIndex(file: ReviewFileSnapshot) {
  const old = new Map<number, DiffAnchor>();
  const next = new Map<number, DiffAnchor>();
  for (const hunk of file.hunks) {
    for (const row of hunk.rows) {
      if (row.oldLineNumber != null) old.set(row.oldLineNumber, row.anchor);
      if (row.newLineNumber != null) next.set(row.newLineNumber, row.anchor);
    }
  }
  return { old, new: next };
}

export function fallbackPatch(file: ReviewFileSnapshot) {
  const oldPath = file.oldPath ?? file.path;
  const lines = [
    `diff --git a/${oldPath} b/${file.path}`,
    `--- a/${oldPath}`,
    `+++ b/${file.path}`
  ];
  for (const hunk of file.hunks) {
    lines.push(hunk.header);
    for (const row of hunk.rows) {
      const prefix =
        row.type === "add" ? "+" : row.type === "delete" ? "-" : " ";
      lines.push(`${prefix}${row.text}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function estimateFileDiffHeight(file: ReviewFileSnapshot) {
  if (file.binary) return 112;
  const rowCount = file.hunks.reduce(
    (total, hunk) => total + hunk.rows.length,
    0
  );
  return 72 + file.hunks.length * 24 + rowCount * 24;
}

export function findAnchorById(file: ReviewFileSnapshot, anchorId: string) {
  if (file.fileAnchor.id === anchorId) return file.fileAnchor;
  for (const hunk of file.hunks) {
    for (const row of hunk.rows) {
      if (row.anchor.id === anchorId) return row.anchor;
    }
  }
  return undefined;
}
