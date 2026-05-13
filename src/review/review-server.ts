import { createReadStream, existsSync, statSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from "node:http";
import { extname, join, normalize } from "node:path";
import { completeReview } from "./review-completion.js";
import { ReviewSession, ReviewSessionError } from "./review-session.js";
import type { ReviewSnapshot } from "./types.js";

export interface ReviewServerOptions {
  readonly assetsDir: string;
  readonly port?: number;
  readonly session?: ReviewSession;
}

export interface ReviewServerResult {
  readonly prompt?: string;
  readonly closed: boolean;
}

export class ReviewServer {
  readonly session: ReviewSession;
  private readonly assetsDir: string;
  private readonly port: number;
  private server?: Server;
  private closeTimer?: NodeJS.Timeout;
  private expiryTimer?: NodeJS.Timeout;
  private result?: ReviewServerResult;
  private readonly completion: Promise<ReviewServerResult>;
  private complete!: (result: ReviewServerResult) => void;

  constructor(snapshot: ReviewSnapshot, options: ReviewServerOptions) {
    this.assetsDir = options.assetsDir;
    this.port = options.port ?? 0;
    this.completion = new Promise<ReviewServerResult>((resolve) => {
      this.complete = resolve;
    });
    this.session =
      options.session ??
      new ReviewSession(snapshot, {
        onClose: (reason) => {
          if (reason !== "submit") {
            this.completeOnce({ closed: true });
          }
          this.closeSoon();
        }
      });
  }

  async start(): Promise<{ url: string; port: number; token: string }> {
    this.server = createServer((request, response) => {
      void this.handle(request, response);
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(this.port, "127.0.0.1", () => resolve());
    });
    this.expiryTimer = setInterval(() => this.session.expireIfNeeded(), 10_000);

    const address = this.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to determine review server address.");
    }
    return {
      url: `http://127.0.0.1:${address.port}/?token=${encodeURIComponent(this.session.token)}`,
      port: address.port,
      token: this.session.token
    };
  }

  async shutdown(): Promise<void> {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = undefined;
    }
    if (this.expiryTimer) {
      clearInterval(this.expiryTimer);
      this.expiryTimer = undefined;
    }
    this.session.shutdown();
    await this.closeServer();
  }

  waitForCompletion(): Promise<ReviewServerResult> {
    return this.completion;
  }

  private async handle(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname.startsWith("/api/")) {
        await this.handleApi(request, response, url);
        return;
      }
      this.serveAsset(url.pathname, response);
    } catch (error) {
      const status =
        error instanceof ReviewSessionError
          ? (error as ReviewSessionError).status
          : 500;
      sendJson(response, status, {
        error: error instanceof Error ? error.message : "Internal server error."
      });
    }
  }

  private async handleApi(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL
  ): Promise<void> {
    const token = tokenFromRequest(request, url);
    if (!token || !this.session.isAuthorized(token)) {
      sendJson(response, 401, { error: "Unauthorized." });
      return;
    }
    const authorizedToken = token;

    const method = request.method ?? "GET";
    if (method === "GET" && url.pathname === "/api/snapshot") {
      this.session.heartbeat(authorizedToken);
      sendJson(response, 200, { snapshot: this.session.snapshot });
      return;
    }
    if (method === "GET" && url.pathname === "/api/drafts") {
      sendJson(response, 200, {
        drafts: this.session.listDrafts(authorizedToken)
      });
      return;
    }
    if (method === "POST" && url.pathname === "/api/drafts") {
      const body = await readJson(request);
      const anchorId =
        typeof body.anchorId === "string"
          ? body.anchorId
          : anchorIdFromBodyAnchor(body.anchor);
      const draft = this.session.saveDraft(
        authorizedToken,
        anchorId,
        requireString(body.body, "body")
      );
      sendJson(response, 200, { draft });
      return;
    }
    if (method === "DELETE" && url.pathname.startsWith("/api/drafts/")) {
      this.session.deleteDraft(
        authorizedToken,
        decodeURIComponent(url.pathname.slice("/api/drafts/".length))
      );
      sendJson(response, 200, { ok: true });
      return;
    }
    if (method === "POST" && url.pathname === "/api/heartbeat") {
      sendJson(response, 200, this.session.heartbeat(authorizedToken));
      return;
    }
    if (method === "POST" && url.pathname === "/api/close") {
      this.session.close(authorizedToken);
      sendJson(response, 200, { ok: true });
      return;
    }
    if (method === "POST" && url.pathname === "/api/submit") {
      const drafts = this.session.submit(authorizedToken);
      const result = completeReview(this.session.snapshot, drafts);
      this.completeOnce(result);
      sendJson(response, 200, { prompt: result.prompt });
      return;
    }

    sendJson(response, 404, { error: "Not found." });
  }

  private serveAsset(pathname: string, response: ServerResponse): void {
    const requestPath = pathname === "/" ? "/index.html" : pathname;
    const normalized = normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
    const fullPath = join(this.assetsDir, normalized);
    if (
      !fullPath.startsWith(this.assetsDir) ||
      !existsSync(fullPath) ||
      !statSync(fullPath).isFile()
    ) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }
    response.statusCode = 200;
    response.setHeader("content-type", contentType(fullPath));
    createReadStream(fullPath).pipe(response);
  }

  private closeSoon(): void {
    this.closeTimer = setTimeout(() => {
      void this.closeServer();
    }, 0);
  }

  private async closeServer(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (!server?.listening) return;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  private completeOnce(result: ReviewServerResult): void {
    if (this.result) return;
    this.result = result;
    this.complete(result);
  }
}

function tokenFromRequest(
  request: IncomingMessage,
  url: URL
): string | undefined {
  const auth = request.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length);
  return url.searchParams.get("token") ?? undefined;
}

async function readJson(
  request: IncomingMessage
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
    string,
    unknown
  >;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new ReviewSessionError(`${field} is required.`);
  }
  return value;
}

function anchorIdFromBodyAnchor(value: unknown): string {
  if (
    typeof value === "object" &&
    value &&
    "id" in value &&
    typeof value.id === "string"
  ) {
    return value.id;
  }
  throw new ReviewSessionError("anchorId is required.");
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown
): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}

function contentType(path: string): string {
  switch (extname(path)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
