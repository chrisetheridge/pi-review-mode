import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface GitFixture {
  readonly root: string;
  git(args: readonly string[]): string;
  write(path: string, text: string | Buffer): void;
  cleanup(): void;
}

export function createGitFixture(): GitFixture {
  const root = mkdtempSync(join(tmpdir(), "pi-review-"));

  const fixture: GitFixture = {
    root,
    git(args) {
      return execFileSync("git", args, {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }).trim();
    },
    write(path, text) {
      const target = join(root, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text);
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    }
  };

  fixture.git(["init", "-b", "main"]);
  fixture.git(["config", "user.name", "Review Fixture"]);
  fixture.git(["config", "user.email", "review-fixture@example.test"]);
  fixture.write("README.md", "initial\n");
  fixture.git(["add", "README.md"]);
  fixture.git(["commit", "-m", "initial"]);

  return fixture;
}
