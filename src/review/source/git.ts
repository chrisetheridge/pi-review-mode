import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { relative } from "node:path";
import { parseReviewDiff } from "../snapshot/parse-diff.js";
import type { ReviewSnapshot } from "../snapshot/types.js";
import type { ReviewScope, ReviewScopeAvailability } from "./scope.types.js";
import {
  buildReviewWarnings,
  calculateReviewStats,
  enforceReviewThresholds,
  ReviewSizeError
} from "./size.js";

export class GitReviewSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitReviewSourceError";
  }
}

export class GitReviewSource {
  readonly repoRoot: string;

  constructor(cwd: string) {
    this.repoRoot = runGit(cwd, ["rev-parse", "--show-toplevel"], {
      errorMessage: "Review must be run inside a Git repository."
    });
  }

  getAvailability(): ReviewScopeAvailability {
    const workingTreeStatus = this.git([
      "status",
      "--porcelain=v1",
      "--untracked-files=all"
    ]);
    const branchBase = this.detectBranchBase();

    return {
      workingTree: workingTreeStatus
        ? {
            available: true,
            scope: {
              kind: "working-tree",
              repoRoot: this.repoRoot,
              label: "Working tree changes"
            }
          }
        : {
            available: false,
            reason: "No staged, unstaged, or untracked working-tree changes."
          },
      branch: branchBase.available
        ? {
            available: true,
            scope: {
              kind: "branch",
              repoRoot: this.repoRoot,
              label: `Branch changes since ${branchBase.base}`,
              base: branchBase.base
            }
          }
        : branchBase
    };
  }

  createBranchScope(base: string): ReviewScope {
    this.assertCommitExists(base, `Base branch '${base}' was not found.`);
    return {
      kind: "branch",
      repoRoot: this.repoRoot,
      label: `Branch changes since ${base}`,
      base
    };
  }

  createSnapshot(scope: ReviewScope): ReviewSnapshot {
    if (scope.kind === "branch") {
      if (!scope.base) {
        throw new GitReviewSourceError("Branch review requires a base branch.");
      }
      this.assertCommitExists(
        scope.base,
        `Base branch '${scope.base}' was not found.`
      );
    }

    const headRef = this.git(["rev-parse", "HEAD"]);
    const baseRef =
      scope.kind === "branch"
        ? this.git(["merge-base", scope.base ?? "", "HEAD"], {
            errorMessage: `Could not find a merge-base with ${scope.base}.`
          })
        : "HEAD";
    const diff =
      scope.kind === "working-tree"
        ? this.workingTreeDiff()
        : this.git(["diff", "--binary", "--find-renames", `${baseRef}..HEAD`]);

    if (!diff.trim()) {
      throw new GitReviewSourceError(
        "There are no reviewable changes for the selected scope."
      );
    }

    const files = parseReviewDiff(diff);
    const stats = calculateReviewStats(files);
    try {
      enforceReviewThresholds(stats);
    } catch (error) {
      if (error instanceof ReviewSizeError) {
        throw new GitReviewSourceError(error.message);
      }
      throw error;
    }
    const warnings = buildReviewWarnings(stats);

    return {
      id: createHash("sha256")
        .update(`${scope.kind}\0${baseRef}\0${headRef}\0${diff}`)
        .digest("hex")
        .slice(0, 24),
      createdAt: new Date().toISOString(),
      repoRoot: this.repoRoot,
      scope: {
        ...scope,
        repoRoot: this.repoRoot,
        mergeBase: scope.kind === "branch" ? baseRef : undefined
      },
      baseRef,
      headRef,
      diff,
      files,
      stats,
      warnings
    };
  }

  private workingTreeDiff(): string {
    const trackedDiff = this.git([
      "diff",
      "--binary",
      "--find-renames",
      "HEAD"
    ]);
    const untracked = this.gitRaw([
      "ls-files",
      "--others",
      "--exclude-standard",
      "-z"
    ])
      .split("\0")
      .filter((path) => path.length > 0);
    const untrackedDiff = untracked
      .map((path) => this.untrackedFileDiff(path))
      .join("");
    return `${trackedDiff}${trackedDiff && untrackedDiff ? "\n" : ""}${untrackedDiff}`;
  }

  private untrackedFileDiff(path: string): string {
    try {
      execFileSync(
        "git",
        ["diff", "--no-index", "--binary", "--", "/dev/null", path],
        {
          cwd: this.repoRoot,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"]
        }
      );
      return "";
    } catch (error) {
      const stdout =
        typeof error === "object" &&
        error &&
        "stdout" in error &&
        (typeof error.stdout === "string" || Buffer.isBuffer(error.stdout))
          ? error.stdout.toString()
          : "";
      if (stdout) return stdout;
      throw error;
    }
  }

  private detectBranchBase():
    | { available: true; base: string }
    | { available: false; reason: string } {
    const upstream = this.tryGit([
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "@{upstream}"
    ]);
    const candidates = [
      upstream,
      "origin/main",
      "origin/master",
      "main",
      "master"
    ].filter(Boolean) as string[];
    const currentBranch = this.tryGit(["rev-parse", "--abbrev-ref", "HEAD"]);

    for (const candidate of candidates) {
      if (candidate === currentBranch) {
        continue;
      }
      if (this.commitExists(candidate)) {
        return { available: true, base: candidate };
      }
    }

    return {
      available: false,
      reason:
        "No base branch found. Tried upstream, origin/main, origin/master, main, and master."
    };
  }

  private assertCommitExists(ref: string, message: string): void {
    if (!this.commitExists(ref)) {
      throw new GitReviewSourceError(message);
    }
  }

  private commitExists(ref: string): boolean {
    return (
      this.tryGit(["rev-parse", "--verify", `${ref}^{commit}`]) !== undefined
    );
  }

  private git(
    args: readonly string[],
    options?: { errorMessage?: string }
  ): string {
    return runGit(this.repoRoot, args, options);
  }

  private gitRaw(
    args: readonly string[],
    options?: { errorMessage?: string }
  ): string {
    return runGitRaw(this.repoRoot, args, options);
  }

  private tryGit(args: readonly string[]): string | undefined {
    try {
      return this.git(args);
    } catch {
      return undefined;
    }
  }
}

function runGit(
  cwd: string,
  args: readonly string[],
  options?: { errorMessage?: string }
): string {
  return runGitRaw(cwd, args, options).trim();
}

function runGitRaw(
  cwd: string,
  args: readonly string[],
  options?: { errorMessage?: string }
): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    throw new GitReviewSourceError(
      options?.errorMessage ?? gitErrorMessage(args, error)
    );
  }
}

function gitErrorMessage(args: readonly string[], error: unknown): string {
  const stderr =
    typeof error === "object" &&
    error &&
    "stderr" in error &&
    Buffer.isBuffer(error.stderr)
      ? error.stderr.toString("utf8").trim()
      : "";
  return stderr || `Git command failed: git ${args.join(" ")}`;
}

export function repoRelativePath(repoRoot: string, path: string): string {
  return relative(repoRoot, path);
}
