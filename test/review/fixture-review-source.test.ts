import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FixtureReviewSource,
  FixtureReviewSourceError
} from "../../src/review/fixture-review-source.js";

const BASIC_DIFF = `diff --git a/README.md b/README.md
index e79c5e8..f00c965 100644
--- a/README.md
+++ b/README.md
@@ -1 +1,2 @@
 initial
+fixture change
`;

describe("FixtureReviewSource", () => {
  const dirs: string[] = [];

  afterEach(() => {
    while (dirs.length) {
      rmSync(dirs.pop() ?? "", { recursive: true, force: true });
    }
  });

  function makeSource(): { root: string; source: FixtureReviewSource } {
    const root = mkdtempSync(join(tmpdir(), "pi-review-fixtures-"));
    mkdirSync(join(root, "fixtures", "review"), { recursive: true });
    dirs.push(root);
    return { root, source: new FixtureReviewSource(root) };
  }

  function writeFixture(root: string, name: string, diff: string): void {
    writeFileSync(join(root, "fixtures", "review", `${name}.diff`), diff);
  }

  it("creates a synthetic working-tree snapshot from a fixture diff", () => {
    const { root, source } = makeSource();
    writeFixture(root, "basic", BASIC_DIFF);

    const snapshot = source.createSnapshot("basic");

    expect(snapshot.repoRoot).toBe(root);
    expect(snapshot.scope).toMatchObject({
      kind: "working-tree",
      label: "Fixture: basic"
    });
    expect(snapshot.baseRef).toBe("fixture-base");
    expect(snapshot.headRef).toBe("fixture-head");
    expect(snapshot.files.map((file) => file.path)).toEqual(["README.md"]);
    expect(snapshot.stats.changedLines).toBe(1);
  });

  it("uses nested paths in the bundled mixed fixture", () => {
    const source = new FixtureReviewSource(process.cwd());

    const snapshot = source.createSnapshot("mixed");

    expect(snapshot.files.map((file) => file.path)).toEqual([
      "packages/core/src/new-name.ts",
      "docs/legacy/remove-me.ts",
      "apps/review-web/src/fixtures/add-me.ts"
    ]);
  });

  it("uses a stable id for identical fixture contents", () => {
    const { root, source } = makeSource();
    writeFixture(root, "basic", BASIC_DIFF);

    const first = source.createSnapshot("basic");
    const second = source.createSnapshot("basic");

    expect(first.id).toBe(second.id);
  });

  it("rejects unsafe fixture names", () => {
    const { source } = makeSource();

    expect(() => source.createSnapshot("../secret")).toThrow(
      "Fixture names must be safe basenames"
    );
    expect(() => source.createSnapshot("basic.diff")).toThrow(
      "Do not include the .diff extension"
    );
  });

  it("lists available fixture names for unknown fixtures", () => {
    const { root, source } = makeSource();
    writeFixture(root, "basic", BASIC_DIFF);
    writeFixture(root, "mixed", BASIC_DIFF);

    expect(() => source.createSnapshot("missing")).toThrow(
      "Unknown review fixture 'missing'. Available fixtures: basic, mixed."
    );
  });

  it("rejects empty or invalid fixture diffs before opening review", () => {
    const { root, source } = makeSource();
    writeFixture(root, "empty", "\n");
    writeFixture(root, "invalid", "not a diff\n");

    expect(() => source.createSnapshot("empty")).toThrow(
      FixtureReviewSourceError
    );
    expect(() => source.createSnapshot("invalid")).toThrow(
      "Fixture diff did not contain reviewable files"
    );
  });
});
