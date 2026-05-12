import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type BrowserOpener, openBrowser } from "./open-browser.js";
import { ReviewServer, type ReviewServerResult } from "./review-server.js";
import type { ReviewSnapshot } from "./types.js";

export interface BrowserReviewSurfaceOptions {
  readonly assetsDir?: string;
  readonly opener?: BrowserOpener;
}

export async function openBrowserReviewSurface(
  snapshot: ReviewSnapshot,
  options: BrowserReviewSurfaceOptions = {}
): Promise<ReviewServerResult> {
  const server = new ReviewServer(snapshot, {
    assetsDir: options.assetsDir ?? defaultAssetsDir()
  });

  try {
    const started = await server.start();
    await (options.opener ?? openBrowser)(started.url);
    return await server.waitForCompletion();
  } finally {
    await server.shutdown();
  }
}

export function defaultAssetsDir(): string {
  const candidates = [
    resolve(process.cwd(), "dist/review-web"),
    resolve(process.cwd(), "src/review-web"),
    resolve(dirname(fileURLToPath(import.meta.url)), "../review-web"),
    resolve(dirname(fileURLToPath(import.meta.url)), "../../../review-web")
  ];
  const found = candidates.find((candidate) =>
    existsSync(join(candidate, "index.html"))
  );
  if (!found) {
    throw new Error(
      "Review web assets were not found. Run pnpm build:web before starting /review."
    );
  }
  return found;
}
