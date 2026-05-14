import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  GitReviewSource,
  GitReviewSourceError
} from "../../src/review/source/git.js";
import { createGitFixture, type GitFixture } from "./fixtures.js";

describe("GitReviewSource", () => {
  const fixtures: GitFixture[] = [];

  afterEach(() => {
    while (fixtures.length) {
      fixtures.pop()?.cleanup();
    }
  });

  function fixture(): GitFixture {
    const created = createGitFixture();
    fixtures.push(created);
    return created;
  }

  it("rejects directories outside a Git repo", () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-review-outside-"));
    try {
      expect(() => new GitReviewSource(dir)).toThrow(
        "Review must be run inside a Git repository"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detects working-tree availability", () => {
    const repo = fixture();
    repo.write("file.txt", "changed\n");

    const availability = new GitReviewSource(repo.root).getAvailability();

    expect(availability.workingTree.available).toBe(true);
  });

  it("creates working-tree snapshots with staged, unstaged, and untracked files", () => {
    const repo = fixture();
    repo.write("staged.txt", "staged\n");
    repo.git(["add", "staged.txt"]);
    repo.write("README.md", "initial\nunstaged\n");
    repo.write("untracked.txt", "untracked\n");
    const source = new GitReviewSource(repo.root);
    const availability = source.getAvailability();
    if (!availability.workingTree.available)
      throw new Error("expected working-tree scope");

    const snapshot = source.createSnapshot(availability.workingTree.scope);

    expect(snapshot.files.map((file) => file.path).sort()).toEqual([
      "README.md",
      "staged.txt",
      "untracked.txt"
    ]);
    expect(snapshot.stats.changedLines).toBeGreaterThan(0);
  });

  it("handles untracked file paths with spaces", () => {
    const repo = fixture();
    repo.write("path with spaces.txt", "new file\n");
    const source = new GitReviewSource(repo.root);
    const availability = source.getAvailability();
    if (!availability.workingTree.available)
      throw new Error("expected working-tree scope");

    const snapshot = source.createSnapshot(availability.workingTree.scope);

    expect(snapshot.files.map((file) => file.path)).toContain(
      "path with spaces.txt"
    );
  });

  it("does not count empty untracked files as added blank lines", () => {
    const repo = fixture();
    repo.write("empty.txt", "");
    const source = new GitReviewSource(repo.root);
    const availability = source.getAvailability();
    if (!availability.workingTree.available)
      throw new Error("expected working-tree scope");

    const snapshot = source.createSnapshot(availability.workingTree.scope);

    expect(snapshot.files[0].path).toBe("empty.txt");
    expect(snapshot.files[0].additions).toBe(0);
    expect(snapshot.stats.changedLines).toBe(0);
  });

  it("allows branch snapshots when the working tree has local changes", () => {
    const repo = fixture();
    repo.git(["checkout", "-b", "feature"]);
    repo.write("feature.txt", "feature\n");
    repo.git(["add", "feature.txt"]);
    repo.git(["commit", "-m", "feature"]);
    repo.write("dirty.txt", "dirty\n");
    const source = new GitReviewSource(repo.root);

    const scope = source.createBranchScope("main");
    const snapshot = source.createSnapshot(scope);

    expect(snapshot.files.map((file) => file.path)).toEqual(["feature.txt"]);
  });

  it("creates branch snapshots from merge-base to HEAD", () => {
    const repo = fixture();
    repo.git(["checkout", "-b", "feature"]);
    repo.write("feature.txt", "feature\n");
    repo.git(["add", "feature.txt"]);
    repo.git(["commit", "-m", "feature"]);
    const source = new GitReviewSource(repo.root);
    const scope = source.createBranchScope("main");

    const snapshot = source.createSnapshot(scope);

    expect(snapshot.baseRef).toMatch(/^[0-9a-f]{40}$/);
    expect(snapshot.files.map((file) => file.path)).toEqual(["feature.txt"]);
  });

  it("rejects invalid base branches", () => {
    const repo = fixture();
    const source = new GitReviewSource(repo.root);

    expect(() => source.createBranchScope("does-not-exist")).toThrow(
      GitReviewSourceError
    );
  });
});
