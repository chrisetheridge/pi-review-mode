import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type GlimpseWindow, open } from "glimpseui";
import { completeReview } from "../session/completion.js";
import {
  InProcessReviewSession,
  InProcessReviewSessionError
} from "../session/in-process.js";
import type { ReviewSnapshot } from "../snapshot/types.js";
import type {
  GlimpseReviewSurfaceOptions,
  GlimpseReviewSurfaceResult,
  GlimpseWindowLike
} from "./glimpse.types.js";

interface ReviewUiRequest {
  readonly type?: string;
  readonly requestId?: string;
  readonly anchorId?: string;
  readonly body?: string;
}

export async function openGlimpseReviewSurface(
  snapshot: ReviewSnapshot,
  options: GlimpseReviewSurfaceOptions = {}
): Promise<GlimpseReviewSurfaceResult> {
  const assetsDir = options.assetsDir ?? defaultGlimpseAssetsDir();
  const indexPath = join(assetsDir, "index.html");
  if (!existsSync(indexPath)) {
    throw new Error(
      "Review web assets were not found. Run pnpm build:web before starting /review."
    );
  }

  const session = new InProcessReviewSession(snapshot, {
    seedDrafts: options.seedDrafts
  });
  const glimpseWindow = (options.openWindow ?? defaultOpenWindow)("", {
    width: 1680,
    height: 1020,
    title: "Pi Review"
  });

  return await new Promise<GlimpseReviewSurfaceResult>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      glimpseWindow.removeListener("message", onMessage);
      glimpseWindow.removeListener("closed", onClosed);
      glimpseWindow.removeListener("error", onError);
    };

    const settle = (result: GlimpseReviewSurfaceResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      session.close();
      resolve(result);
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      session.close();
      reject(error);
    };

    const sendResponse = (requestId: string, data: unknown) => {
      sendHostMessage(glimpseWindow, {
        type: "review:response",
        requestId,
        ok: true,
        data
      });
    };

    const sendError = (requestId: string, error: unknown) => {
      sendHostMessage(glimpseWindow, {
        type: "review:response",
        requestId,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    };

    const onMessage = (data: unknown): void => {
      const message = data as ReviewUiRequest;
      const requestId = message.requestId;
      if (!requestId) return;

      try {
        switch (message.type) {
          case "review:ready":
            sendResponse(requestId, {
              snapshot: session.snapshot,
              drafts: session.listDrafts()
            });
            return;
          case "review:list-drafts":
            sendResponse(requestId, { drafts: session.listDrafts() });
            return;
          case "review:save-draft":
            sendResponse(requestId, {
              draft: session.saveDraft(
                requireString(message.anchorId, "anchorId"),
                requireString(message.body, "body")
              )
            });
            return;
          case "review:delete-draft":
            session.deleteDraft(requireString(message.anchorId, "anchorId"));
            sendResponse(requestId, { ok: true });
            return;
          case "review:submit": {
            const drafts = session.submit();
            const result = completeReview(session.snapshot, drafts);
            sendResponse(requestId, { prompt: result.prompt });
            void Promise.resolve(options.onSubmitPrompt?.(result.prompt))
              .then(() => settle({ prompt: result.prompt, closed: false }))
              .catch(fail);
            return;
          }
          case "review:cancel":
            sendResponse(requestId, { ok: true });
            settle({ closed: true });
            return;
          default:
            throw new InProcessReviewSessionError("Unknown review message.");
        }
      } catch (error) {
        sendError(requestId, error);
      }
    };

    const onClosed = (): void => {
      settle({ closed: true });
    };

    const onError = (error: Error): void => {
      fail(error);
    };

    glimpseWindow.on("message", onMessage);
    glimpseWindow.on("closed", onClosed);
    glimpseWindow.on("error", onError);
    glimpseWindow.loadFile(indexPath);
  });
}

export function defaultGlimpseAssetsDir(): string {
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

function defaultOpenWindow(
  html: string,
  options: {
    readonly width: number;
    readonly height: number;
    readonly title: string;
  }
): GlimpseWindow {
  return open(html, options);
}

function sendHostMessage(window: GlimpseWindowLike, message: unknown): void {
  window.send(
    `window.__PI_REVIEW_RECEIVE__(${escapeForInlineScript(
      JSON.stringify(message)
    )});`
  );
}

function escapeForInlineScript(value: string): string {
  return value
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new InProcessReviewSessionError(`${name} is required.`);
  }
  return value;
}
