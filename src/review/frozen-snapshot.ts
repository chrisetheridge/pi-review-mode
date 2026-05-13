import type {
  ReviewAnchor,
  ReviewFileSnapshot,
  ReviewSnapshot
} from "./types.js";

export function resolveSnapshotAnchor(
  snapshot: ReviewSnapshot,
  anchorId: string
): ReviewAnchor | undefined {
  for (const file of snapshot.files) {
    if (file.anchor.id === anchorId) return file.anchor;
    for (const hunk of file.hunks) {
      for (const row of hunk.rows) {
        if (row.anchor.id === anchorId) return row.anchor;
      }
    }
  }
  return undefined;
}

export function snapshotFileForAnchor(
  snapshot: ReviewSnapshot,
  anchor: Pick<ReviewAnchor, "id" | "path">
): ReviewFileSnapshot | undefined {
  for (const file of snapshot.files) {
    if (file.anchor.id === anchor.id) return file;
    if (file.path !== anchor.path) continue;
    for (const hunk of file.hunks) {
      if (hunk.rows.some((row) => row.anchor.id === anchor.id)) {
        return file;
      }
    }
  }
  return undefined;
}

export function snapshotHasAnchor(
  snapshot: ReviewSnapshot,
  anchorId: string
): boolean {
  return resolveSnapshotAnchor(snapshot, anchorId) !== undefined;
}
