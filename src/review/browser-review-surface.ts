import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type BrowserOpener, openBrowser } from "./open-browser.js";
import { ReviewServer, type ReviewServerResult } from "./review-server.js";
import type { SeedReviewDraftInput } from "./review-session.js";
import type { ReviewSnapshot } from "./types.js";

interface BrowserReviewServer {
  start(): Promise<{ url: string; port: number; token: string }>;
  waitForCompletion(): Promise<ReviewServerResult>;
  shutdown(): Promise<void>;
}

export interface BrowserReviewSurfaceOptions {
  readonly assetsDir?: string;
  readonly opener?: BrowserOpener;
  readonly onSubmitPrompt?: (prompt: string) => Promise<void> | void;
  readonly seedDrafts?: readonly SeedReviewDraftInput[];
  readonly serverFactory?: (snapshot: ReviewSnapshot) => BrowserReviewServer;
  readonly webDevServerUrl?: string;
}

export async function openBrowserReviewSurface(
  snapshot: ReviewSnapshot,
  options: BrowserReviewSurfaceOptions = {}
): Promise<ReviewServerResult> {
  const webDevServerUrl =
    options.webDevServerUrl ?? process.env.PI_REVIEW_WEB_DEV_SERVER;
  const server =
    options.serverFactory?.(snapshot) ??
    new ReviewServer(snapshot, {
      assetsDir:
        options.assetsDir ??
        (webDevServerUrl ? process.cwd() : defaultAssetsDir()),
      seedDrafts: options.seedDrafts,
      webDevServerUrl
    });

  try {
    const started = await server.start();
    await (options.opener ?? openBrowser)(started.url);
    const result = await server.waitForCompletion();
    if (result.prompt) {
      await options.onSubmitPrompt?.(result.prompt);
    }
    void server.shutdown().catch(() => undefined);
    return result;
  } catch (error) {
    await server.shutdown().catch(() => undefined);
    throw error;
  }
}

export function defaultAssetsDir(): string {
  const candidates = [
    resolve(process.cwd(), "dist/review-web"),
    resolve(process.cwd(), "apps/review-web"),
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
