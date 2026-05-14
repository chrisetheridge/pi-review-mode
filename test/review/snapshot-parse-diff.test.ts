import { describe, expect, it } from "vitest";
import { parseReviewDiff } from "../../src/review/snapshot/parse-diff.js";

describe("parseReviewDiff", () => {
  it("parses hunks and distinct anchors for repeated line text", () => {
    const [file] = parseReviewDiff(`diff --git a/a.txt b/a.txt
index 7898192..422c2b7 100644
--- a/a.txt
+++ b/a.txt
@@ -1,3 +1,4 @@
 same
-same
+same
+same
 end
`);

    expect(file.path).toBe("a.txt");
    expect(file.patch).toContain("diff --git a/a.txt b/a.txt");
    expect(file.patch).toContain("@@ -1,3 +1,4 @@");
    expect(file.additions).toBe(2);
    expect(file.deletions).toBe(1);
    const sameRows = file.hunks[0].rows.filter((row) => row.text === "same");
    expect(new Set(sameRows.map((row) => row.anchor.id)).size).toBe(
      sameRows.length
    );
  });

  it("handles renamed files and paths with spaces", () => {
    const [file] = parseReviewDiff(`diff --git a/old name.txt b/new name.txt
similarity index 88%
rename from old name.txt
rename to new name.txt
index 257cc56..5716ca5 100644
--- a/old name.txt
+++ b/new name.txt
@@ -1 +1 @@
-old
+new
`);

    expect(file.status).toBe("renamed");
    expect(file.oldPath).toBe("old name.txt");
    expect(file.path).toBe("new name.txt");
  });

  it("handles deleted and binary files", () => {
    const files = parseReviewDiff(`diff --git a/deleted.txt b/deleted.txt
deleted file mode 100644
index 3bd1f0e..0000000
--- a/deleted.txt
+++ /dev/null
@@ -1 +0,0 @@
-gone
diff --git a/image.png b/image.png
new file mode 100644
index 0000000..1234567
Binary files /dev/null and b/image.png differ
`);

    expect(files[0].status).toBe("deleted");
    expect(files[0].path).toBe("deleted.txt");
    expect(files[1].binary).toBe(true);
    expect(files[1].hunks).toHaveLength(0);
  });
});
