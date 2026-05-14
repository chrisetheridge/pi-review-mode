import type { ReviewAnchor, ReviewSnapshot } from "./types.js";

export function buildAgentReviewPrompt(
  snapshot: ReviewSnapshot,
  reviewId: string
): string {
  const lines: string[] = [
    "Please review this frozen Git diff snapshot before I open the native review window.",
    "",
    "This is a visible pre-review request from the Pi review-mode extension.",
    "",
    "## Review metadata",
    "",
    `Review ID: ${reviewId}`,
    `Repository: ${snapshot.repoRoot}`,
    `Scope: ${snapshot.scope.label}`,
    `Snapshot: ${snapshot.id}`,
    `Created: ${snapshot.createdAt}`,
    `Head: ${snapshot.headRef}`
  ];

  if (snapshot.baseRef) {
    lines.push(`Base: ${snapshot.baseRef}`);
  }

  lines.push(
    "",
    "## Rules",
    "",
    "- Review only this frozen Git diff snapshot. The working tree may change after this request.",
    "- You may inspect current files with read-only tools if helpful for context.",
    "- Do not edit files, run formatters, or mutate the repository during this pre-review.",
    "- Comment only on anchors listed in the catalog below.",
    "- Use exact `anchorId` values from the catalog. Do not invent anchors or refer to arbitrary lines outside the snapshot.",
    "- For range feedback, anchor to one relevant line and mention the range in the comment body.",
    "- Submit comments by calling `submit_review_mode_comments` with this shape:",
    "",
    "```json",
    "{",
    `  "reviewId": "${reviewId}",`,
    '  "comments": [',
    '    { "anchorId": "...", "body": "..." }',
    "  ]",
    "}",
    "```",
    "",
    "If you find no issues, call `submit_review_mode_comments` with an empty comments array.",
    "",
    "## Anchor catalog"
  );

  for (const file of snapshot.files) {
    lines.push("", `### ${file.path}`, anchorLine(file.anchor));
    for (const hunk of file.hunks) {
      lines.push("", `Hunk ${hunk.index}: ${hunk.header}`);
      for (const row of hunk.rows) {
        const prefix =
          row.kind === "add" ? "+" : row.kind === "delete" ? "-" : " ";
        const oldLine =
          row.oldLineNumber == null ? "" : `old ${row.oldLineNumber}`;
        const newLine =
          row.newLineNumber == null ? "" : `new ${row.newLineNumber}`;
        const location = [oldLine, newLine].filter(Boolean).join(" / ");
        lines.push(
          `${anchorLine(row.anchor)} ${location} ${prefix}${row.text}`.trimEnd()
        );
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

function anchorLine(anchor: ReviewAnchor): string {
  if (anchor.side === "file") {
    return `- anchorId: ${anchor.id} (file-level)`;
  }
  return `- anchorId: ${anchor.id}`;
}
