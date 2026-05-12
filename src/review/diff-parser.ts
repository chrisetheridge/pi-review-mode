import { createHash } from "node:crypto";
import type { Change, File as GitDiffFile } from "gitdiff-parser";
import * as gitDiffParserModule from "gitdiff-parser";
import type {
  ReviewAnchor,
  ReviewDiffHunk,
  ReviewDiffRow,
  ReviewDiffRowKind,
  ReviewFileSnapshot,
  ReviewFileStatus
} from "./types.js";

const gitDiffParser =
  (
    gitDiffParserModule as unknown as {
      default?: GitDiffParser;
      parse?: GitDiffParser["parse"];
    }
  ).default ?? (gitDiffParserModule as unknown as GitDiffParser);

interface GitDiffParser {
  parse(source: string): GitDiffFile[];
}

export function parseReviewDiff(diff: string): ReviewFileSnapshot[] {
  const parsedFiles = gitDiffParser.parse(diff);
  const metadataByFile = collectMetadata(diff);
  return parsedFiles.map((file, fileIndex) =>
    toReviewFile(file, metadataByFile[fileIndex] ?? [])
  );
}

function toReviewFile(
  file: GitDiffFile,
  metadata: readonly string[]
): ReviewFileSnapshot {
  const path = stripGitPath(
    file.newPath === "/dev/null" ? file.oldPath : file.newPath
  );
  const oldPath =
    file.oldPath && file.oldPath !== path && file.oldPath !== "/dev/null"
      ? stripGitPath(file.oldPath)
      : undefined;
  const binary =
    Boolean(file.isBinary) ||
    metadata.some(
      (line) => line.startsWith("Binary files ") || line === "GIT binary patch"
    );
  let additions = 0;
  let deletions = 0;
  const hunks: ReviewDiffHunk[] = file.hunks.map((hunk, hunkIndex) => {
    const rows: ReviewDiffRow[] = hunk.changes.map((change, rowIndex) => {
      const kind = changeKind(change);
      if (kind === "add") additions += 1;
      if (kind === "delete") deletions += 1;
      const oldLineNumber =
        change.type === "normal"
          ? change.oldLineNumber
          : change.type === "delete"
            ? change.lineNumber
            : undefined;
      const newLineNumber =
        change.type === "normal"
          ? change.newLineNumber
          : change.type === "insert"
            ? change.lineNumber
            : undefined;
      return {
        anchor: makeLineAnchor({
          path,
          oldPath,
          side: kind === "delete" ? "old" : "new",
          hunkIndex,
          hunkHeader: hunk.content,
          oldLineNumber,
          newLineNumber,
          rowIndex,
          lineText: change.content
        }),
        kind,
        text: change.content,
        oldLineNumber,
        newLineNumber,
        rowIndex
      };
    });

    return {
      index: hunkIndex,
      header: hunk.content,
      oldStart: hunk.oldStart,
      oldLines: hunk.oldLines,
      newStart: hunk.newStart,
      newLines: hunk.newLines,
      rows
    };
  });

  return {
    anchor: makeFileAnchor(path, oldPath),
    status: statusFromGitDiffFile(file, binary, metadata),
    path,
    oldPath,
    metadata,
    additions,
    deletions,
    binary,
    hunks
  };
}

function collectMetadata(diff: string): string[][] {
  const files: string[][] = [];
  const lines = diff.split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.startsWith("diff --git ")) {
      index += 1;
      continue;
    }

    const metadata: string[] = [line];
    index += 1;
    while (index < lines.length && !lines[index].startsWith("diff --git ")) {
      const current = lines[index];
      if (current.startsWith("@@ ")) {
        metadata.push(current);
        index += 1;
        while (
          index < lines.length &&
          !lines[index].startsWith("diff --git ") &&
          !lines[index].startsWith("@@ ")
        ) {
          index += 1;
        }
        continue;
      }

      metadata.push(current);
      index += 1;
    }
    files.push(metadata);
  }

  return files;
}

function changeKind(change: Change): ReviewDiffRowKind {
  if (change.type === "insert") return "add";
  if (change.type === "delete") return "delete";
  return "context";
}

function statusFromGitDiffFile(
  file: GitDiffFile,
  binary: boolean,
  metadata: readonly string[]
): ReviewFileStatus {
  if (file.type === "add") return binary ? "binary" : "added";
  if (file.type === "delete") return "deleted";
  if (file.type === "rename") return "renamed";
  if (file.type === "copy") return "copied";
  if (
    metadata.some(
      (line) => line.startsWith("rename from ") || line.startsWith("rename to ")
    )
  )
    return "renamed";
  if (
    metadata.some(
      (line) => line.startsWith("copy from ") || line.startsWith("copy to ")
    )
  )
    return "copied";
  if (binary) return "binary";
  return "modified";
}

function stripGitPath(path: string): string {
  return path
    .replace(/\t$/, "")
    .replace(/^"(.+)"$/, "$1")
    .replace(/\\"/g, '"');
}

function makeFileAnchor(path: string, oldPath?: string): ReviewAnchor {
  return {
    id: anchorId(["file", path, oldPath ?? ""]),
    path: stripGitPath(path),
    oldPath: oldPath ? stripGitPath(oldPath) : undefined,
    side: "file"
  };
}

function makeLineAnchor(anchor: Omit<ReviewAnchor, "id">): ReviewAnchor {
  const normalized = {
    ...anchor,
    path: stripGitPath(anchor.path),
    oldPath: anchor.oldPath ? stripGitPath(anchor.oldPath) : undefined
  };
  return {
    ...normalized,
    id: anchorId([
      "line",
      normalized.path,
      normalized.oldPath ?? "",
      normalized.side,
      String(normalized.hunkIndex ?? ""),
      normalized.hunkHeader ?? "",
      String(normalized.oldLineNumber ?? ""),
      String(normalized.newLineNumber ?? ""),
      String(normalized.rowIndex ?? ""),
      normalized.lineText ?? ""
    ])
  };
}

function anchorId(parts: readonly string[]): string {
  return createHash("sha256")
    .update(parts.join("\0"))
    .digest("hex")
    .slice(0, 24);
}
