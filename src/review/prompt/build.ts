import type { ReviewDraft } from "../session/draft.types.js";
import type { ReviewFileSnapshot, ReviewSnapshot } from "../snapshot/types.js";

export function buildReviewPrompt(
  snapshot: ReviewSnapshot,
  drafts: readonly ReviewDraft[]
): string {
  const draftByFile = groupDraftsByFile(snapshot.files, drafts);
  const lines: string[] = [
    "# Code review feedback",
    "",
    "These comments were drafted against a frozen Git diff snapshot. Before acting on them, inspect the current files because the working tree or branch may have changed since the snapshot was created.",
    "",
    `Repository: ${snapshot.repoRoot}`,
    `Scope: ${snapshot.scope.label}`,
    `Snapshot: ${snapshot.id}`,
    `Head: ${snapshot.headRef}`
  ];
  if (snapshot.baseRef) {
    lines.push(`Base: ${snapshot.baseRef}`);
  }
  lines.push("", "## Comments");

  for (const file of snapshot.files) {
    const fileDrafts = draftByFile.get(file.path) ?? [];
    if (fileDrafts.length === 0) continue;

    lines.push("", `### ${file.path}`);
    if (file.oldPath) {
      lines.push(`Renamed from: ${file.oldPath}`);
    }

    const sorted = [...fileDrafts].sort(
      (a, b) => draftSortKey(a) - draftSortKey(b)
    );
    for (const draft of sorted) {
      lines.push("");
      if (draft.anchor.side === "file") {
        lines.push(`- File comment: ${draft.body}`);
        continue;
      }
      const lineLabel =
        draft.anchor.side === "old"
          ? `old line ${draft.anchor.oldLineNumber ?? "?"}`
          : `new line ${draft.anchor.newLineNumber ?? "?"}`;
      lines.push(`- ${lineLabel}: ${draft.body}`);
      const context = compactContext(file, draft.anchor.id);
      if (context.length) {
        lines.push("", "  ```diff");
        for (const contextLine of context) {
          lines.push(`  ${contextLine}`);
        }
        lines.push("  ```");
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

function groupDraftsByFile(
  files: readonly ReviewFileSnapshot[],
  drafts: readonly ReviewDraft[]
): Map<string, ReviewDraft[]> {
  const order = new Set(files.map((file) => file.path));
  const groups = new Map<string, ReviewDraft[]>();
  for (const draft of drafts) {
    if (!order.has(draft.anchor.path)) continue;
    const group = groups.get(draft.anchor.path) ?? [];
    group.push(draft);
    groups.set(draft.anchor.path, group);
  }
  return groups;
}

function draftSortKey(draft: ReviewDraft): number {
  if (draft.anchor.side === "file") return -1;
  return (
    (draft.anchor.hunkIndex ?? 0) * 1_000_000 + (draft.anchor.rowIndex ?? 0)
  );
}

function compactContext(file: ReviewFileSnapshot, anchorId: string): string[] {
  for (const hunk of file.hunks) {
    const rowIndex = hunk.rows.findIndex((row) => row.anchor.id === anchorId);
    if (rowIndex === -1) continue;
    const start = Math.max(0, rowIndex - 2);
    const end = Math.min(hunk.rows.length, rowIndex + 3);
    return hunk.rows.slice(start, end).map((row) => {
      const prefix =
        row.kind === "add" ? "+" : row.kind === "delete" ? "-" : " ";
      return `${prefix}${row.text}`;
    });
  }
  return [];
}
