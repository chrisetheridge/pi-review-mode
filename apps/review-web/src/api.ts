import type {
  DiffAnchor,
  DiffHunk,
  DiffRow,
  ReviewFileSnapshot,
  ReviewSnapshot,
  SaveCommentRequest,
  SavedComment,
  SubmitResponse
} from "./types";

export class ReviewApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ReviewApiError";
    this.status = status;
  }
}

export function readTokenFromLocation(
  location: Location = window.location
): string {
  return new URLSearchParams(location.search).get("token") ?? "";
}

export function readApiBaseUrlFromLocation(
  location: Location = window.location
): string {
  return new URLSearchParams(location.search).get("apiBaseUrl") ?? "";
}

export function createReviewApi(
  token: string,
  baseUrl = readApiBaseUrlFromLocation()
) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = new URL(`/api${path}`, window.location.origin);
    if (baseUrl) {
      const explicit = new URL(`/api${path}`, baseUrl);
      url.protocol = explicit.protocol;
      url.host = explicit.host;
    }
    url.searchParams.set("token", token);

    const response = await fetch(url.toString(), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init.headers
      }
    });

    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;
      try {
        const payload = (await response.json()) as { error?: string };
        message = payload.error ?? message;
      } catch {
        message = response.statusText || message;
      }
      throw new ReviewApiError(message, response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  return {
    getSnapshot: async () =>
      normalizeSnapshot(await request<unknown>("/snapshot")),
    getDrafts: async () => normalizeDrafts(await request<unknown>("/drafts")),
    saveDraft: (draft: SaveCommentRequest) =>
      request<unknown>("/drafts", {
        method: "POST",
        body: JSON.stringify(draft)
      }).then(normalizeDraft),
    deleteDraft: (anchorId: string) =>
      request<void>(`/drafts/${encodeURIComponent(anchorId)}`, {
        method: "DELETE"
      }),
    heartbeat: () =>
      request<void>("/heartbeat", {
        method: "POST",
        body: "{}"
      }),
    close: () =>
      request<void>("/close", {
        method: "POST",
        body: "{}"
      }),
    submit: () =>
      request<SubmitResponse>("/submit", {
        method: "POST",
        body: "{}"
      })
  };
}

export type ReviewApi = ReturnType<typeof createReviewApi>;

export function closeReviewWithBeacon(token: string): void {
  const apiBaseUrl = readApiBaseUrlFromLocation();
  const url = new URL("/api/close", apiBaseUrl || window.location.origin);
  url.searchParams.set("token", token);
  const payload = new Blob(["{}"], { type: "application/json" });
  if (navigator.sendBeacon?.(url.toString(), payload)) {
    return;
  }
  void fetch(url.toString(), {
    method: "POST",
    body: "{}",
    headers: { "Content-Type": "application/json" },
    keepalive: true
  }).catch(() => undefined);
}

function normalizeSnapshot(payload: unknown): ReviewSnapshot {
  const raw = unwrap<Record<string, unknown>>(payload, "snapshot");
  const stats = raw.stats as ReviewSnapshot["stats"];
  return {
    id: String(raw.id),
    title:
      typeof raw.title === "string"
        ? raw.title
        : String(
            (raw.scope as { label?: string } | undefined)?.label ??
              "Review changes"
          ),
    baseRef: typeof raw.baseRef === "string" ? raw.baseRef : undefined,
    headRef: typeof raw.headRef === "string" ? raw.headRef : undefined,
    stats: {
      filesChanged: stats.filesChanged,
      additions: stats.additions,
      deletions: stats.deletions
    },
    files: ((raw.files as unknown[]) ?? []).map(normalizeFile)
  };
}

function normalizeFile(rawValue: unknown): ReviewFileSnapshot {
  const raw = rawValue as Record<string, unknown>;
  const path = String(raw.path);
  return {
    path,
    oldPath: typeof raw.oldPath === "string" ? raw.oldPath : undefined,
    status: raw.status as ReviewFileSnapshot["status"],
    additions: Number(raw.additions),
    deletions: Number(raw.deletions),
    binary: Boolean(raw.binary),
    fileAnchor: normalizeAnchor(raw.fileAnchor ?? raw.anchor, path),
    hunks: ((raw.hunks as unknown[]) ?? []).map((hunk) =>
      normalizeHunk(hunk, path)
    )
  };
}

function normalizeHunk(rawValue: unknown, path: string): DiffHunk {
  const raw = rawValue as Record<string, unknown>;
  return {
    header: String(raw.header),
    rows: ((raw.rows as unknown[]) ?? []).map((row) => normalizeRow(row, path))
  };
}

function normalizeRow(rawValue: unknown, path: string): DiffRow {
  const raw = rawValue as Record<string, unknown>;
  return {
    type: (raw.type ?? raw.kind) as DiffRow["type"],
    oldLineNumber:
      typeof raw.oldLineNumber === "number" ? raw.oldLineNumber : undefined,
    newLineNumber:
      typeof raw.newLineNumber === "number" ? raw.newLineNumber : undefined,
    text: String(raw.text),
    anchor: normalizeAnchor(raw.anchor, path)
  };
}

function normalizeDrafts(payload: unknown): SavedComment[] {
  return unwrap<unknown[]>(payload, "drafts").map(normalizeDraft);
}

function normalizeDraft(payload: unknown): SavedComment {
  const raw = unwrap<Record<string, unknown>>(payload, "draft");
  const anchor = raw.anchor as DiffAnchor | undefined;
  const anchorId =
    typeof raw.anchorId === "string" ? raw.anchorId : String(anchor?.id);
  const backendAnchorPath =
    typeof (anchor as { path?: unknown } | undefined)?.path === "string"
      ? (anchor as unknown as { path: string }).path
      : undefined;
  const filePath =
    typeof raw.filePath === "string"
      ? raw.filePath
      : String(anchor?.filePath ?? backendAnchorPath);
  return {
    id: typeof raw.id === "string" ? raw.id : anchorId,
    anchorId,
    filePath,
    body: String(raw.body),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined
  };
}

function normalizeAnchor(rawValue: unknown, fallbackPath: string): DiffAnchor {
  const raw = rawValue as Record<string, unknown>;
  return {
    id: String(raw.id),
    filePath:
      typeof raw.filePath === "string"
        ? raw.filePath
        : String(raw.path ?? fallbackPath),
    side: raw.side as DiffAnchor["side"],
    hunkIndex: typeof raw.hunkIndex === "number" ? raw.hunkIndex : undefined,
    hunkHeader: typeof raw.hunkHeader === "string" ? raw.hunkHeader : undefined,
    oldLineNumber:
      typeof raw.oldLineNumber === "number" ? raw.oldLineNumber : undefined,
    newLineNumber:
      typeof raw.newLineNumber === "number" ? raw.newLineNumber : undefined,
    rowIndex: typeof raw.rowIndex === "number" ? raw.rowIndex : undefined,
    lineText: typeof raw.lineText === "string" ? raw.lineText : undefined
  };
}

function unwrap<T>(payload: unknown, key: string): T {
  if (typeof payload === "object" && payload && key in payload) {
    return (payload as Record<string, T>)[key];
  }
  return payload as T;
}
