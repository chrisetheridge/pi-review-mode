import type { ReviewDiffStats } from "../snapshot/types.js";
import {
  REVIEW_MAX_CHANGED_LINES,
  REVIEW_MAX_FILES,
  REVIEW_WARN_CHANGED_LINES,
  REVIEW_WARN_FILES
} from "./limits.js";

export class ReviewSizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewSizeError";
  }
}

export function calculateReviewStats(
  files: readonly { additions: number; deletions: number }[]
): ReviewDiffStats {
  const additions = files.reduce((total, file) => total + file.additions, 0);
  const deletions = files.reduce((total, file) => total + file.deletions, 0);
  return {
    filesChanged: files.length,
    additions,
    deletions,
    changedLines: additions + deletions
  };
}

export function enforceReviewThresholds(stats: ReviewDiffStats): void {
  if (stats.filesChanged > REVIEW_MAX_FILES) {
    throw new ReviewSizeError(
      `Review is too large (${stats.filesChanged} files). Split the review into smaller changes before using /review.`
    );
  }
  if (stats.changedLines > REVIEW_MAX_CHANGED_LINES) {
    throw new ReviewSizeError(
      `Review is too large (${stats.changedLines} changed lines). Split the review into smaller changes before using /review.`
    );
  }
}

export function buildReviewWarnings(stats: ReviewDiffStats): string[] {
  const warnings: string[] = [];
  if (stats.filesChanged > REVIEW_WARN_FILES) {
    warnings.push(`Large review: ${stats.filesChanged} files changed.`);
  }
  if (stats.changedLines > REVIEW_WARN_CHANGED_LINES) {
    warnings.push(`Large review: ${stats.changedLines} changed lines.`);
  }
  return warnings;
}
