import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseReviewDiff } from "../../src/review/diff-parser.js";
import { ReviewServer } from "../../src/review/review-server.js";
import type { ReviewSnapshot } from "../../src/review/types.js";

describe("ReviewServer", () => {
  const servers: ReviewServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.map((server) => server.shutdown()));
    servers.length = 0;
  });

  async function start(): Promise<{
    server: ReviewServer;
    url: string;
    token: string;
  }> {
    const server = new ReviewServer(snapshot(), {
      assetsDir: join(process.cwd(), "test/fixtures/review-assets")
    });
    servers.push(server);
    const started = await server.start();
    return { server, url: started.url, token: started.token };
  }

  it("serves assets on 127.0.0.1", async () => {
    const { url } = await start();

    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:/);
    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("review assets");
  });

  it("requires token for api endpoints", async () => {
    const { url } = await start();
    const api = new URL("/api/snapshot", url);

    const response = await fetch(api);

    expect(response.status).toBe(401);
  });

  it("supports draft lifecycle and submit prompt", async () => {
    const { url, token, server } = await start();
    const snapshotResponse = await fetch(
      withToken("/api/snapshot", url, token)
    );
    const snapshotBody = (await snapshotResponse.json()) as {
      snapshot: ReviewSnapshot;
    };
    const anchorId = snapshotBody.snapshot.files[0].anchor.id;

    const saveResponse = await fetch(withToken("/api/drafts", url, token), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ anchorId, body: "Looks good to adjust." })
    });
    expect(saveResponse.status).toBe(200);

    const draftsResponse = await fetch(withToken("/api/drafts", url, token));
    expect(
      ((await draftsResponse.json()) as { drafts: unknown[] }).drafts
    ).toHaveLength(1);

    const submitResponse = await fetch(withToken("/api/submit", url, token), {
      method: "POST"
    });
    const submitBody = (await submitResponse.json()) as { prompt: string };
    expect(submitResponse.status).toBe(200);
    expect(submitBody.prompt).toContain("Looks good to adjust.");
    expect(server.session.isClosed()).toBe(true);
  });

  it("rejects submit with no saved comments", async () => {
    const { url, token } = await start();

    const response = await fetch(withToken("/api/submit", url, token), {
      method: "POST"
    });

    expect(response.status).toBe(400);
  });

  it("closes through the close endpoint", async () => {
    const { url, token, server } = await start();

    const response = await fetch(withToken("/api/close", url, token), {
      method: "POST"
    });

    expect(response.status).toBe(200);
    expect(server.session.isClosed()).toBe(true);
  });
});

function withToken(path: string, base: string, token: string): string {
  const url = new URL(path, base);
  url.searchParams.set("token", token);
  return url.toString();
}

function snapshot(): ReviewSnapshot {
  const diff = `diff --git a/file.txt b/file.txt
--- a/file.txt
+++ b/file.txt
@@ -1 +1,2 @@
 keep
+add
`;
  const files = parseReviewDiff(diff);
  return {
    id: "snapshot",
    createdAt: "2026-05-12T00:00:00.000Z",
    repoRoot: "/repo",
    scope: {
      kind: "working-tree",
      repoRoot: "/repo",
      label: "Working tree changes"
    },
    baseRef: "HEAD",
    headRef: "head",
    diff,
    files,
    stats: { filesChanged: 1, additions: 1, deletions: 0, changedLines: 1 },
    warnings: []
  };
}
