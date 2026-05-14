# Replace HTTP Review Surface With Glimpse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tokenized localhost browser review surface with a Glimpse-hosted native WebView surface that communicates with the extension over Glimpse messages.

**Architecture:** The extension still computes an immutable Git `ReviewSnapshot`, but no longer starts an HTTP server for the review UI. A new in-process review session owns ephemeral drafts and prompt completion; a new Glimpse surface opens bundled Vite assets in a native WebView and bridges request/response messages between React and the extension. The web app talks to a transport abstraction so tests can use a fake transport and production can use `window.glimpse`.

**Tech Stack:** TypeScript, Pi extension APIs, Glimpse (`glimpseui`), React/Vite review UI, Vitest, Testing Library.

---

## Scope and Decisions

### In scope

- Make Glimpse the production `/review` surface.
- Remove production dependency on `ReviewServer`, token auth, heartbeat, close endpoint, CORS, and `openBrowser`.
- Keep snapshot immutability, draft validation, seeded agent comments, submit blocking, prompt generation, and editor insertion behavior.
- Keep browser-like web UI assets bundled locally under `dist/review-web/**`.
- Keep web UI tests running in jsdom through injectable transports.
- Keep fixture mode working.
- Update docs and smoke tests to reflect the native Glimpse window.

### Out of scope

- Supporting both browser and Glimpse surfaces at runtime.
- Persisting drafts across Glimpse window reloads.
- Direct code editing from the review UI.
- Adding Monaco, split diffs, syntax highlighting, threaded comments, search, or read/unread state.
- Modifying Pi core.

### Key semantic changes

- **Token removed:** Glimpse UI is a child process/WebView controlled by the extension. Messages arrive over the Glimpse JSON-lines bridge, not an unauthenticated local network port.
- **Heartbeat removed:** Window lifecycle is explicit through `closed`, `cancel`, `submit`, and `error` events.
- **Close endpoint removed:** The UI sends a `close`/`cancel` bridge message. Native window close resolves as `{ closed: true }`.
- **Timeout removed:** Review drafts are in memory and are discarded when the command resolves or Pi shuts down.
- **Server removed from production path:** No HTTP server is started for `/review`.

---

## File Structure

### Create

- `src/review/in-process-review-session.ts`
  - Owns snapshot, seeded drafts, save/delete/list/submit/close behavior without token, heartbeat, TTL, or HTTP status coupling.
- `src/review/glimpse-review-surface.ts`
  - Opens Glimpse, loads the bundled review UI, handles UI request messages, sends responses, resolves on submit/cancel/window-close/error.
- `src/review/glimpseui.d.ts`
  - Local TypeScript declaration for `glimpseui` if the package still ships no `.d.ts` files.
- `test/review/in-process-review-session.test.ts`
  - Unit tests for tokenless draft/session behavior.
- `test/review/glimpse-review-surface.test.ts`
  - Unit tests using a fake Glimpse window/opener, no native process.
- `apps/review-web/src/review-transport.ts`
  - Shared transport interface plus `ReviewTransportError`.
- `apps/review-web/src/glimpse-transport.ts`
  - Browser-side `window.glimpse` request/response bridge.
- `apps/review-web/src/http-transport.ts` only if a transitional test helper is needed; otherwise avoid it.

### Modify

- `package.json`
  - Add `glimpseui` runtime dependency.
  - Ensure packaged files include built extension and built web assets.
  - Ensure Pi extension entry stays compatible with the repository’s current build/install convention.
- `apps/review-web/vite.config.ts`
  - Set `base: "./"` so `file://`/Glimpse-loaded built assets resolve relative to `index.html`.
- `apps/review-web/src/api.ts`
  - Either delete after migration or reduce to pure normalization helpers reused by transports.
- `apps/review-web/src/use-review-surface-state.ts`
  - Replace `ReviewApi` + token requirements with `ReviewTransport`.
  - Remove heartbeat and beacon effects.
- `apps/review-web/src/App.tsx`
  - Remove token reading from production path.
  - Create Glimpse transport by default.
- `apps/review-web/src/App.test.tsx`, `apps/review-web/src/api.test.ts`, component tests as needed
  - Update tests to inject fake `ReviewTransport` instead of fake `ReviewApi`/token.
- `src/index.ts`
  - Import and call `openGlimpseReviewSurface` instead of `openBrowserReviewSurface`.
  - Update notifications from “browser review” to “review window” / “native review window”.
- `src/review/index.ts`
  - Export Glimpse surface and in-process session.
  - Stop exporting browser/server modules if they are deleted.
- `src/review/review-server.ts`, `src/review/browser-review-surface.ts`, `src/review/open-browser.ts`
  - Delete after replacement, or leave unused only if tests still need them during an incremental commit. Final state should remove them from production exports.
- `test/review/review-session.test.ts`, `test/review/review-server.test.ts`, `test/review/browser-review-surface.test.ts`
  - Delete or replace with new in-process/Glimpse tests.
- `CONTEXT.md`
  - Update domain terms and responsibilities: Glimpse native WebView, message bridge, in-process session.
  - Remove rules requiring token authorization/local server for the primary surface.
- `README.md`
  - Update installation/runtime docs and manual smoke tests.
  - Add Glimpse native host requirements.
- `docs/prd/2026-05-12-native-review-mode-prd.md`
  - Add an amendment section describing the Glimpse pivot, or update the lifecycle/security sections if this branch is intended to become canonical.

---

## Bridge Protocol

Use request/response messages so every UI action has deterministic completion/error handling.

### UI to extension

```ts
export type ReviewUiRequest =
  | { type: "review:ready"; requestId: string }
  | { type: "review:list-drafts"; requestId: string }
  | {
      type: "review:save-draft";
      requestId: string;
      anchorId: string;
      body: string;
    }
  | { type: "review:delete-draft"; requestId: string; anchorId: string }
  | { type: "review:submit"; requestId: string }
  | { type: "review:cancel"; requestId: string };
```

### Extension to UI

```ts
export type ReviewHostResponse =
  | {
      type: "review:response";
      requestId: string;
      ok: true;
      data?: unknown;
    }
  | {
      type: "review:response";
      requestId: string;
      ok: false;
      error: string;
    };
```

`review:ready` returns:

```ts
{
  snapshot: ReviewSnapshot;
  drafts: ReviewDraft[];
}
```

`review:list-drafts` returns:

```ts
{
  drafts: ReviewDraft[];
}
```

`review:save-draft` returns:

```ts
{
  draft: ReviewDraft;
}
```

`review:delete-draft` returns:

```ts
{
  ok: true;
}
```

`review:submit` returns:

```ts
{
  prompt: string;
}
```

`review:cancel` returns:

```ts
{
  ok: true;
}
```

### Browser-side global typing

```ts
declare global {
  interface Window {
    glimpse?: {
      send(message: unknown): void;
      close?(): void;
    };
    __PI_REVIEW_RECEIVE__?: (message: unknown) => void;
  }
}
```

---

## Task 1: Add Glimpse dependency and local types

**Files:**
- Modify: `package.json`
- Create: `src/review/glimpseui.d.ts`

- [ ] **Step 1: Add `glimpseui` as a runtime dependency**

Run:

```sh
pnpm add glimpseui
```

Expected:

- `package.json` has a new dependency entry similar to:

```json
"dependencies": {
  "gitdiff-parser": "^0.3.1",
  "glimpseui": "^0.8.0",
  "typebox": "^1.1.38"
}
```

- `pnpm-lock.yaml` changes.

- [ ] **Step 2: Create TypeScript declarations for the package**

Create `src/review/glimpseui.d.ts`:

```ts
declare module "glimpseui" {
  import type { EventEmitter } from "node:events";

  export interface GlimpseOpenOptions {
    readonly width?: number;
    readonly height?: number;
    readonly title?: string;
    readonly x?: number;
    readonly y?: number;
    readonly frameless?: boolean;
    readonly floating?: boolean;
    readonly transparent?: boolean;
    readonly clickThrough?: boolean;
    readonly noDock?: boolean;
    readonly hidden?: boolean;
    readonly autoClose?: boolean;
  }

  export interface GlimpseWindow extends EventEmitter {
    send(js: string): void;
    setHTML(html: string): void;
    loadFile(path: string): void;
    show(options?: { readonly title?: string }): void;
    close(): void;
    on(event: "message", listener: (data: unknown) => void): this;
    on(event: "closed", listener: () => void): this;
    on(event: "error", listener: (error: Error) => void): this;
    once(event: "message", listener: (data: unknown) => void): this;
    once(event: "closed", listener: () => void): this;
    once(event: "error", listener: (error: Error) => void): this;
    removeListener(event: "message", listener: (data: unknown) => void): this;
    removeListener(event: "closed", listener: () => void): this;
    removeListener(event: "error", listener: (error: Error) => void): this;
  }

  export function open(html: string, options?: GlimpseOpenOptions): GlimpseWindow;
}
```

- [ ] **Step 3: Verify dependency/type setup**

Run:

```sh
pnpm typecheck
```

Expected: Typecheck may still fail later only if unrelated current workspace failures exist. At this point, no error should mention missing module `glimpseui`.

- [ ] **Step 4: Commit**

```sh
git add package.json pnpm-lock.yaml src/review/glimpseui.d.ts
git commit -m "chore: add glimpse review host dependency"
```

---

## Task 2: Extract tokenless in-process review session

**Files:**
- Create: `src/review/in-process-review-session.ts`
- Create: `test/review/in-process-review-session.test.ts`

- [ ] **Step 1: Write failing session tests**

Create `test/review/in-process-review-session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { InProcessReviewSession, InProcessReviewSessionError } from "../../src/review/in-process-review-session.js";
import { parseReviewDiff } from "../../src/review/diff-parser.js";
import type { ReviewSnapshot } from "../../src/review/types.js";

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
    createdAt: "2026-05-14T00:00:00.000Z",
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

describe("InProcessReviewSession", () => {
  it("seeds valid drafts and ignores invalid seed anchors", () => {
    const reviewSnapshot = snapshot();
    const session = new InProcessReviewSession(reviewSnapshot, {
      now: () => 0,
      seedDrafts: [
        {
          anchorId: reviewSnapshot.files[0].anchor.id,
          body: " seeded note ",
          source: "agent"
        },
        { anchorId: "missing", body: "ignored", source: "agent" }
      ]
    });

    expect(session.listDrafts()).toEqual([
      {
        anchor: reviewSnapshot.files[0].anchor,
        body: "seeded note",
        updatedAt: "1970-01-01T00:00:00.000Z",
        source: "agent"
      }
    ]);
  });

  it("saves user drafts by anchor id and trims bodies", () => {
    const reviewSnapshot = snapshot();
    const session = new InProcessReviewSession(reviewSnapshot, {
      now: () => 1_000
    });
    const anchor = reviewSnapshot.files[0].hunks[0].rows[1].anchor;

    const draft = session.saveDraft(anchor.id, "  please fix this  ");

    expect(draft).toEqual({
      anchor,
      body: "please fix this",
      updatedAt: "1970-01-01T00:00:01.000Z",
      source: "user"
    });
    expect(session.listDrafts()).toEqual([draft]);
  });

  it("preserves seeded draft source when edited", () => {
    const reviewSnapshot = snapshot();
    const anchor = reviewSnapshot.files[0].anchor;
    const session = new InProcessReviewSession(reviewSnapshot, {
      now: () => 2_000,
      seedDrafts: [{ anchorId: anchor.id, body: "agent note", source: "agent" }]
    });

    expect(session.saveDraft(anchor.id, "updated").source).toBe("agent");
  });

  it("rejects unknown anchors and blank bodies", () => {
    const session = new InProcessReviewSession(snapshot());

    expect(() => session.saveDraft("missing", "body")).toThrow(
      new InProcessReviewSessionError("Unknown review anchor.")
    );
    expect(() => session.saveDraft(snapshot().files[0].anchor.id, "   ")).toThrow(
      new InProcessReviewSessionError("Comment body is required.")
    );
  });

  it("deletes drafts", () => {
    const reviewSnapshot = snapshot();
    const anchor = reviewSnapshot.files[0].anchor;
    const session = new InProcessReviewSession(reviewSnapshot);
    session.saveDraft(anchor.id, "note");

    session.deleteDraft(anchor.id);

    expect(session.listDrafts()).toEqual([]);
  });

  it("blocks submit with no drafts", () => {
    const session = new InProcessReviewSession(snapshot());

    expect(() => session.submit()).toThrow(
      new InProcessReviewSessionError("Save at least one comment before submitting.")
    );
  });

  it("returns submitted drafts and closes", () => {
    const reviewSnapshot = snapshot();
    const anchor = reviewSnapshot.files[0].anchor;
    const session = new InProcessReviewSession(reviewSnapshot);
    const draft = session.saveDraft(anchor.id, "note");

    expect(session.submit()).toEqual([draft]);
    expect(session.isClosed()).toBe(true);
    expect(session.isSubmitted()).toBe(true);
    expect(session.listDrafts()).toEqual([]);
  });

  it("rejects operations after close", () => {
    const reviewSnapshot = snapshot();
    const session = new InProcessReviewSession(reviewSnapshot);
    session.close();

    expect(() => session.saveDraft(reviewSnapshot.files[0].anchor.id, "note")).toThrow(
      new InProcessReviewSessionError("Review session is closed.")
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```sh
pnpm test -- --run test/review/in-process-review-session.test.ts
```

Expected: FAIL because `src/review/in-process-review-session.ts` does not exist.

- [ ] **Step 3: Implement minimal tokenless session**

Create `src/review/in-process-review-session.ts`:

```ts
import { resolveSnapshotAnchor } from "./frozen-snapshot.js";
import type {
  ReviewDraft,
  ReviewDraftSource,
  ReviewSnapshot
} from "./types.js";

export class InProcessReviewSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InProcessReviewSessionError";
  }
}

export interface SeedReviewDraftInput {
  readonly anchorId: string;
  readonly body: string;
  readonly source: ReviewDraftSource;
}

export interface InProcessReviewSessionOptions {
  readonly now?: () => number;
  readonly seedDrafts?: readonly SeedReviewDraftInput[];
}

export class InProcessReviewSession {
  readonly snapshot: ReviewSnapshot;
  private readonly now: () => number;
  private readonly drafts = new Map<string, ReviewDraft>();
  private closed = false;
  private submitted = false;

  constructor(
    snapshot: ReviewSnapshot,
    options: InProcessReviewSessionOptions = {}
  ) {
    this.snapshot = snapshot;
    this.now = options.now ?? Date.now;
    for (const seed of options.seedDrafts ?? []) {
      this.seedDraft(seed);
    }
  }

  listDrafts(): ReviewDraft[] {
    if (this.closed) return [];
    return [...this.drafts.values()];
  }

  saveDraft(anchorId: string, body: string): ReviewDraft {
    this.assertUsable();
    const anchor = resolveSnapshotAnchor(this.snapshot, anchorId);
    if (!anchor) {
      throw new InProcessReviewSessionError("Unknown review anchor.");
    }
    const trimmed = body.trim();
    if (!trimmed) {
      throw new InProcessReviewSessionError("Comment body is required.");
    }
    const existing = this.drafts.get(anchorId);
    const draft: ReviewDraft = {
      anchor,
      body: trimmed,
      updatedAt: new Date(this.now()).toISOString(),
      source: existing?.source ?? "user"
    };
    this.drafts.set(anchorId, draft);
    return draft;
  }

  deleteDraft(anchorId: string): void {
    this.assertUsable();
    this.drafts.delete(anchorId);
  }

  submit(): ReviewDraft[] {
    this.assertUsable();
    if (this.drafts.size === 0) {
      throw new InProcessReviewSessionError(
        "Save at least one comment before submitting."
      );
    }
    const submittedDrafts = [...this.drafts.values()];
    this.submitted = true;
    this.finish();
    return submittedDrafts;
  }

  close(): void {
    if (!this.closed) {
      this.finish();
    }
  }

  isClosed(): boolean {
    return this.closed;
  }

  isSubmitted(): boolean {
    return this.submitted;
  }

  private seedDraft(seed: SeedReviewDraftInput): void {
    const anchor = resolveSnapshotAnchor(this.snapshot, seed.anchorId);
    if (!anchor) return;
    const body = seed.body.trim();
    if (!body) return;
    this.drafts.set(seed.anchorId, {
      anchor,
      body,
      updatedAt: new Date(this.now()).toISOString(),
      source: seed.source
    });
  }

  private assertUsable(): void {
    if (this.closed) {
      throw new InProcessReviewSessionError("Review session is closed.");
    }
  }

  private finish(): void {
    this.closed = true;
    this.drafts.clear();
  }
}
```

- [ ] **Step 4: Run targeted tests**

Run:

```sh
pnpm test -- --run test/review/in-process-review-session.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add src/review/in-process-review-session.ts test/review/in-process-review-session.test.ts
git commit -m "feat: add tokenless review session"
```

---

## Task 3: Add web transport abstraction

**Files:**
- Create: `apps/review-web/src/review-transport.ts`
- Modify: `apps/review-web/src/api.ts`
- Modify: `apps/review-web/src/api.test.ts`

- [ ] **Step 1: Create shared transport contract**

Create `apps/review-web/src/review-transport.ts`:

```ts
import type {
  ReviewSnapshot,
  SaveCommentRequest,
  SavedComment,
  SubmitResponse
} from "./types";

export class ReviewTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewTransportError";
  }
}

export interface ReviewTransport {
  load(): Promise<{ snapshot: ReviewSnapshot; drafts: SavedComment[] }>;
  saveDraft(draft: SaveCommentRequest): Promise<SavedComment>;
  deleteDraft(anchorId: string): Promise<void>;
  close(): Promise<void>;
  submit(): Promise<SubmitResponse>;
}
```

- [ ] **Step 2: Refactor normalization helpers out of HTTP assumptions**

Modify `apps/review-web/src/api.ts` so normalization helpers are exported and can normalize direct Glimpse payloads. Keep existing HTTP functions temporarily so tests can be migrated gradually.

Add these exports around the existing helper declarations:

```ts
export function normalizeReviewSnapshotForTransport(payload: unknown): ReviewSnapshot {
  return normalizeSnapshot(payload);
}

export function normalizeSavedCommentsForTransport(payload: unknown): SavedComment[] {
  return normalizeDrafts(payload);
}

export function normalizeSavedCommentForTransport(payload: unknown): SavedComment {
  return normalizeDraft(payload);
}
```

Keep `normalizeDraftForTest` as-is or change it to re-export the new helper:

```ts
export const normalizeDraftForTest = normalizeSavedCommentForTransport;
```

- [ ] **Step 3: Update or add normalization tests for direct payloads**

Add to `apps/review-web/src/api.test.ts`:

```ts
import {
  normalizeReviewSnapshotForTransport,
  normalizeSavedCommentForTransport,
  normalizeSavedCommentsForTransport
} from "./api";

describe("transport normalization", () => {
  it("normalizes a direct snapshot payload", () => {
    expect(
      normalizeReviewSnapshotForTransport({
        id: "s1",
        scope: { label: "Working tree" },
        stats: { filesChanged: 1, additions: 2, deletions: 3 },
        files: [
          {
            path: "file.txt",
            status: "modified",
            additions: 2,
            deletions: 3,
            binary: false,
            anchor: { id: "file:file.txt", path: "file.txt", side: "file" },
            hunks: []
          }
        ]
      })
    ).toMatchObject({
      id: "s1",
      title: "Working tree",
      stats: { filesChanged: 1, additions: 2, deletions: 3 },
      files: [
        {
          path: "file.txt",
          fileAnchor: { id: "file:file.txt", filePath: "file.txt", side: "file" }
        }
      ]
    });
  });

  it("normalizes direct draft arrays and single drafts", () => {
    const draft = {
      anchor: { id: "a1", path: "file.txt", side: "file" },
      body: "note",
      updatedAt: "2026-05-14T00:00:00.000Z",
      source: "agent"
    };

    expect(normalizeSavedCommentForTransport(draft)).toMatchObject({
      id: "a1",
      anchorId: "a1",
      filePath: "file.txt",
      body: "note",
      source: "agent"
    });
    expect(normalizeSavedCommentsForTransport([draft])).toHaveLength(1);
  });
});
```

If the current file already imports these names or has a single `describe`, merge these cases into the existing describe block instead of duplicating incompatible imports.

- [ ] **Step 4: Run web normalization tests**

Run:

```sh
pnpm test -- --run apps/review-web/src/api.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add apps/review-web/src/review-transport.ts apps/review-web/src/api.ts apps/review-web/src/api.test.ts
git commit -m "refactor: introduce review transport contract"
```

---

## Task 4: Implement Glimpse browser-side transport

**Files:**
- Create: `apps/review-web/src/glimpse-transport.ts`
- Create or modify: `apps/review-web/src/vite-env.d.ts`
- Create: `apps/review-web/src/glimpse-transport.test.ts`

- [ ] **Step 1: Write failing Glimpse transport tests**

Create `apps/review-web/src/glimpse-transport.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGlimpseReviewTransport } from "./glimpse-transport";
import { ReviewTransportError } from "./review-transport";

function installGlimpse(send: (message: unknown) => void) {
  window.glimpse = { send };
}

describe("createGlimpseReviewTransport", () => {
  beforeEach(() => {
    delete window.glimpse;
    delete window.__PI_REVIEW_RECEIVE__;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends a ready request and resolves load from host response", async () => {
    const sent: unknown[] = [];
    installGlimpse((message) => sent.push(message));
    const transport = createGlimpseReviewTransport();

    const promise = transport.load();
    const request = sent[0] as { requestId: string; type: string };
    expect(request.type).toBe("review:ready");

    window.__PI_REVIEW_RECEIVE__?.({
      type: "review:response",
      requestId: request.requestId,
      ok: true,
      data: {
        snapshot: {
          id: "s1",
          scope: { label: "Working tree" },
          stats: { filesChanged: 0, additions: 0, deletions: 0 },
          files: []
        },
        drafts: []
      }
    });

    await expect(promise).resolves.toEqual({
      snapshot: {
        id: "s1",
        title: "Working tree",
        baseRef: undefined,
        headRef: undefined,
        stats: { filesChanged: 0, additions: 0, deletions: 0 },
        files: []
      },
      drafts: []
    });
  });

  it("rejects host errors", async () => {
    const sent: unknown[] = [];
    installGlimpse((message) => sent.push(message));
    const transport = createGlimpseReviewTransport();

    const promise = transport.submit();
    const request = sent[0] as { requestId: string };
    window.__PI_REVIEW_RECEIVE__?.({
      type: "review:response",
      requestId: request.requestId,
      ok: false,
      error: "Save at least one comment before submitting."
    });

    await expect(promise).rejects.toEqual(
      new ReviewTransportError("Save at least one comment before submitting.")
    );
  });

  it("fails when Glimpse is unavailable", async () => {
    const transport = createGlimpseReviewTransport();

    await expect(transport.load()).rejects.toEqual(
      new ReviewTransportError("Native review bridge is unavailable.")
    );
  });

  it("times out unanswered requests", async () => {
    vi.useFakeTimers();
    installGlimpse(() => undefined);
    const transport = createGlimpseReviewTransport({ timeoutMs: 25 });

    const promise = transport.close();
    await vi.advanceTimersByTimeAsync(25);

    await expect(promise).rejects.toEqual(
      new ReviewTransportError("Native review bridge request timed out.")
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```sh
pnpm test -- --run apps/review-web/src/glimpse-transport.test.ts
```

Expected: FAIL because `glimpse-transport.ts` does not exist.

- [ ] **Step 3: Add browser global types**

Append to `apps/review-web/src/vite-env.d.ts`:

```ts
interface Window {
  glimpse?: {
    send(message: unknown): void;
    close?(): void;
  };
  __PI_REVIEW_RECEIVE__?: (message: unknown) => void;
}
```

- [ ] **Step 4: Implement Glimpse transport**

Create `apps/review-web/src/glimpse-transport.ts`:

```ts
import {
  normalizeReviewSnapshotForTransport,
  normalizeSavedCommentForTransport,
  normalizeSavedCommentsForTransport
} from "./api";
import type { ReviewTransport } from "./review-transport";
import { ReviewTransportError } from "./review-transport";
import type { SaveCommentRequest, SubmitResponse } from "./types";

interface PendingRequest {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timer: number;
}

interface GlimpseTransportOptions {
  readonly timeoutMs?: number;
}

let nextRequestId = 0;

export function createGlimpseReviewTransport(
  options: GlimpseTransportOptions = {}
): ReviewTransport {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const pending = new Map<string, PendingRequest>();

  window.__PI_REVIEW_RECEIVE__ = (message: unknown) => {
    const raw = message as {
      type?: string;
      requestId?: string;
      ok?: boolean;
      data?: unknown;
      error?: string;
    };
    if (raw.type !== "review:response" || !raw.requestId) return;
    const request = pending.get(raw.requestId);
    if (!request) return;
    pending.delete(raw.requestId);
    window.clearTimeout(request.timer);
    if (raw.ok) {
      request.resolve(raw.data);
    } else {
      request.reject(
        new ReviewTransportError(raw.error ?? "Native review request failed.")
      );
    }
  };

  function request<T>(type: string, payload: Record<string, unknown> = {}) {
    if (!window.glimpse?.send) {
      return Promise.reject(
        new ReviewTransportError("Native review bridge is unavailable.")
      );
    }
    const requestId = `review-${++nextRequestId}`;
    const promise = new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        pending.delete(requestId);
        reject(
          new ReviewTransportError("Native review bridge request timed out.")
        );
      }, timeoutMs);
      pending.set(requestId, {
        resolve: (value) => resolve(value as T),
        reject,
        timer
      });
    });
    window.glimpse.send({ type, requestId, ...payload });
    return promise;
  }

  return {
    async load() {
      const data = await request<{ snapshot: unknown; drafts: unknown }>(
        "review:ready"
      );
      return {
        snapshot: normalizeReviewSnapshotForTransport(data.snapshot),
        drafts: normalizeSavedCommentsForTransport(data.drafts)
      };
    },
    async saveDraft(draft: SaveCommentRequest) {
      const data = await request<{ draft: unknown }>("review:save-draft", {
        anchorId: draft.anchor.id,
        body: draft.body
      });
      return normalizeSavedCommentForTransport(data.draft);
    },
    async deleteDraft(anchorId: string) {
      await request("review:delete-draft", { anchorId });
    },
    async close() {
      await request("review:cancel");
      window.glimpse?.close?.();
    },
    async submit() {
      return request<SubmitResponse>("review:submit");
    }
  };
}
```

- [ ] **Step 5: Run targeted transport tests**

Run:

```sh
pnpm test -- --run apps/review-web/src/glimpse-transport.test.ts apps/review-web/src/api.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```sh
git add apps/review-web/src/glimpse-transport.ts apps/review-web/src/glimpse-transport.test.ts apps/review-web/src/vite-env.d.ts
git commit -m "feat: add glimpse review web transport"
```

---

## Task 5: Move React state from token API to transport

**Files:**
- Modify: `apps/review-web/src/use-review-surface-state.ts`
- Modify: `apps/review-web/src/App.tsx`
- Modify: `apps/review-web/src/App.test.tsx`
- Modify: affected component tests if they construct `App`

- [ ] **Step 1: Update state hook tests first if present**

If there is no dedicated hook test, update `apps/review-web/src/App.test.tsx` to use this fake transport shape in its test helpers:

```ts
import type { ReviewTransport } from "./review-transport";

function fakeTransport(overrides: Partial<ReviewTransport> = {}): ReviewTransport {
  return {
    load: async () => ({ snapshot: testSnapshot, drafts: [] }),
    saveDraft: async (draft) => ({
      id: draft.anchor.id,
      anchorId: draft.anchor.id,
      filePath: draft.anchor.filePath,
      body: draft.body,
      updatedAt: "2026-05-14T00:00:00.000Z",
      source: "user"
    }),
    deleteDraft: async () => undefined,
    close: async () => undefined,
    submit: async () => ({ prompt: "Review prompt" }),
    ...overrides
  };
}
```

Change `render(<App api={...} token="token" />)` calls to:

```tsx
render(<App transport={fakeTransport()} />);
```

- [ ] **Step 2: Run app tests to verify failures before implementation**

Run:

```sh
pnpm test -- --run apps/review-web/src/App.test.tsx
```

Expected: FAIL because `App` does not accept `transport` yet and the hook still expects `api`/`token`.

- [ ] **Step 3: Refactor the hook to `ReviewTransport`**

Replace the imports and options in `apps/review-web/src/use-review-surface-state.ts`.

New imports:

```ts
import { useEffect, useState } from "react";
import type { ReviewTransport } from "./review-transport";
import type { DiffAnchor, ReviewSnapshot, SavedComment } from "./types";
```

New options interface:

```ts
interface UseReviewSurfaceStateOptions {
  transport: ReviewTransport;
}
```

New function signature:

```ts
export function useReviewSurfaceState({
  transport
}: UseReviewSurfaceStateOptions) {
```

Replace initial error state:

```ts
const [error, setError] = useState<string | null>(null);
```

Replace the initial load effect with:

```ts
useEffect(() => {
  let cancelled = false;
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await transport.load();
      if (cancelled) return;
      setSnapshot(result.snapshot);
      setComments(result.drafts);
      setSelectedPath(result.snapshot.files[0]?.path ?? null);
    } catch (err) {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Unable to load review.");
      }
    } finally {
      if (!cancelled) setLoading(false);
    }
  }
  void load();
  return () => {
    cancelled = true;
  };
}, [transport]);
```

Delete both effects that call `api.heartbeat()` and `closeReviewWithBeacon()`.

Update operations:

```ts
async function saveComment(anchor: DiffAnchor, body: string) {
  const saved = await transport.saveDraft({ anchor, body });
  setComments((current) => [
    saved,
    ...current.filter((comment) => comment.anchorId !== saved.anchorId)
  ]);
  cancelEditor(anchor.id);
}

async function deleteComment(anchorId: string) {
  await transport.deleteDraft(anchorId);
  setComments((current) =>
    current.filter((comment) => comment.anchorId !== anchorId)
  );
}

async function closeReview() {
  await transport.close();
}

async function submitReview() {
  setSubmitError(null);
  if (comments.length === 0) {
    setSubmitError("Add at least one saved comment before submitting.");
    return;
  }
  if (activeEditors.length > 0) {
    setSubmitError("Save or cancel unsaved comments before submitting.");
    return;
  }
  try {
    const response = await transport.submit();
    setSubmittedPrompt(response.prompt);
  } catch (err) {
    setSubmitError(
      err instanceof Error ? err.message : "Unable to submit review."
    );
  }
}
```

- [ ] **Step 4: Refactor `App` to default to Glimpse transport**

Modify `apps/review-web/src/App.tsx` imports:

```ts
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createGlimpseReviewTransport } from "./glimpse-transport";
import type { ReviewTransport } from "./review-transport";
```

Replace props:

```ts
interface AppProps {
  transport?: ReviewTransport;
}
```

Replace transport creation:

```ts
const transport = useMemo(
  () => providedTransport ?? createGlimpseReviewTransport(),
  [providedTransport]
);
```

Rename function parameter:

```ts
export function App({ transport: providedTransport }: AppProps) {
```

Update hook call:

```ts
} = useReviewSurfaceState({ transport });
```

Remove `createReviewApi`, `ReviewApi`, and `readTokenFromLocation` imports/usages.

- [ ] **Step 5: Run web tests**

Run:

```sh
pnpm test -- --run apps/review-web/src/App.test.tsx apps/review-web/src/glimpse-transport.test.ts apps/review-web/src/api.test.ts
```

Expected: PASS after updating tests to inject a fake transport.

- [ ] **Step 6: Commit**

```sh
git add apps/review-web/src/use-review-surface-state.ts apps/review-web/src/App.tsx apps/review-web/src/App.test.tsx
git commit -m "refactor: drive review UI through transport"
```

---

## Task 6: Build the Glimpse review surface host

**Files:**
- Create: `src/review/glimpse-review-surface.ts`
- Create: `test/review/glimpse-review-surface.test.ts`
- Modify: `src/review/index.ts`

- [ ] **Step 1: Write fake-window tests for the host**

Create `test/review/glimpse-review-surface.test.ts`:

```ts
import { EventEmitter } from "node:events";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openGlimpseReviewSurface, type GlimpseWindowLike } from "../../src/review/glimpse-review-surface.js";
import { parseReviewDiff } from "../../src/review/diff-parser.js";
import type { ReviewSnapshot } from "../../src/review/types.js";

class FakeGlimpseWindow extends EventEmitter implements GlimpseWindowLike {
  readonly sentScripts: string[] = [];
  loadedFile: string | undefined;
  closed = false;

  send(js: string): void {
    this.sentScripts.push(js);
  }

  loadFile(path: string): void {
    this.loadedFile = path;
  }

  close(): void {
    this.closed = true;
    this.emit("closed");
  }
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
    createdAt: "2026-05-14T00:00:00.000Z",
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

function parseLastHostMessage(window: FakeGlimpseWindow) {
  const script = window.sentScripts.at(-1) ?? "";
  const match = script.match(/window\.__PI_REVIEW_RECEIVE__\((.*)\);?$/);
  if (!match) throw new Error(`Unable to parse host script: ${script}`);
  return JSON.parse(match[1]);
}

describe("openGlimpseReviewSurface", () => {
  it("loads bundled index.html and responds to ready", async () => {
    const fakeWindow = new FakeGlimpseWindow();
    const reviewSnapshot = snapshot();

    void openGlimpseReviewSurface(reviewSnapshot, {
      assetsDir: join(process.cwd(), "test/fixtures/review-assets"),
      openWindow: () => fakeWindow
    });

    expect(fakeWindow.loadedFile).toBe(
      join(process.cwd(), "test/fixtures/review-assets", "index.html")
    );

    fakeWindow.emit("message", {
      type: "review:ready",
      requestId: "r1"
    });

    expect(parseLastHostMessage(fakeWindow)).toMatchObject({
      type: "review:response",
      requestId: "r1",
      ok: true,
      data: {
        snapshot: { id: "snapshot" },
        drafts: []
      }
    });
    fakeWindow.emit("message", { type: "review:cancel", requestId: "cancel" });
  });

  it("saves drafts and submits a prompt", async () => {
    const fakeWindow = new FakeGlimpseWindow();
    const reviewSnapshot = snapshot();
    const resultPromise = openGlimpseReviewSurface(reviewSnapshot, {
      assetsDir: join(process.cwd(), "test/fixtures/review-assets"),
      openWindow: () => fakeWindow
    });
    const anchorId = reviewSnapshot.files[0].anchor.id;

    fakeWindow.emit("message", {
      type: "review:save-draft",
      requestId: "save",
      anchorId,
      body: "Please fix this."
    });
    expect(parseLastHostMessage(fakeWindow)).toMatchObject({
      requestId: "save",
      ok: true,
      data: { draft: { body: "Please fix this." } }
    });

    fakeWindow.emit("message", { type: "review:submit", requestId: "submit" });
    const submitResponse = parseLastHostMessage(fakeWindow);
    expect(submitResponse).toMatchObject({
      requestId: "submit",
      ok: true,
      data: { prompt: expect.stringContaining("Please fix this.") }
    });
    await expect(resultPromise).resolves.toMatchObject({
      closed: false,
      prompt: expect.stringContaining("Please fix this.")
    });
  });

  it("resolves closed when the window closes", async () => {
    const fakeWindow = new FakeGlimpseWindow();
    const resultPromise = openGlimpseReviewSurface(snapshot(), {
      assetsDir: join(process.cwd(), "test/fixtures/review-assets"),
      openWindow: () => fakeWindow
    });

    fakeWindow.emit("closed");

    await expect(resultPromise).resolves.toEqual({ closed: true });
  });

  it("returns host errors without resolving the review", async () => {
    const fakeWindow = new FakeGlimpseWindow();
    void openGlimpseReviewSurface(snapshot(), {
      assetsDir: join(process.cwd(), "test/fixtures/review-assets"),
      openWindow: () => fakeWindow
    });

    fakeWindow.emit("message", {
      type: "review:save-draft",
      requestId: "bad",
      anchorId: "missing",
      body: "note"
    });

    expect(parseLastHostMessage(fakeWindow)).toEqual({
      type: "review:response",
      requestId: "bad",
      ok: false,
      error: "Unknown review anchor."
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```sh
pnpm test -- --run test/review/glimpse-review-surface.test.ts
```

Expected: FAIL because `glimpse-review-surface.ts` does not exist.

- [ ] **Step 3: Implement Glimpse surface**

Create `src/review/glimpse-review-surface.ts`:

```ts
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { open, type GlimpseWindow } from "glimpseui";
import { completeReview } from "./review-completion.js";
import {
  InProcessReviewSession,
  InProcessReviewSessionError,
  type SeedReviewDraftInput
} from "./in-process-review-session.js";
import type { ReviewSnapshot } from "./types.js";

export interface GlimpseWindowLike {
  send(js: string): void;
  loadFile(path: string): void;
  close(): void;
  on(event: "message", listener: (data: unknown) => void): this;
  on(event: "closed", listener: () => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  removeListener(event: "message", listener: (data: unknown) => void): this;
  removeListener(event: "closed", listener: () => void): this;
  removeListener(event: "error", listener: (error: Error) => void): this;
}

export interface GlimpseReviewSurfaceOptions {
  readonly assetsDir?: string;
  readonly seedDrafts?: readonly SeedReviewDraftInput[];
  readonly openWindow?: (html: string, options: { width: number; height: number; title: string }) => GlimpseWindowLike;
  readonly onSubmitPrompt?: (prompt: string) => Promise<void> | void;
}

export interface GlimpseReviewSurfaceResult {
  readonly prompt?: string;
  readonly closed: boolean;
}

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
  const window = (options.openWindow ?? defaultOpenWindow)("", {
    width: 1680,
    height: 1020,
    title: "pi review"
  });

  return await new Promise<GlimpseReviewSurfaceResult>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      window.removeListener("message", onMessage);
      window.removeListener("closed", onClosed);
      window.removeListener("error", onError);
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
      sendHostMessage(window, {
        type: "review:response",
        requestId,
        ok: true,
        data
      });
    };

    const sendError = (requestId: string, error: unknown) => {
      sendHostMessage(window, {
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
          case "review:list-drafts":
            sendResponse(requestId, {
              snapshot: session.snapshot,
              drafts: session.listDrafts()
            });
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

    window.on("message", onMessage);
    window.on("closed", onClosed);
    window.on("error", onError);
    window.loadFile(indexPath);
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
  options: { width: number; height: number; title: string }
): GlimpseWindow {
  return open(html, options);
}

function sendHostMessage(window: GlimpseWindowLike, message: unknown): void {
  window.send(`window.__PI_REVIEW_RECEIVE__(${escapeForInlineScript(JSON.stringify(message))});`);
}

function escapeForInlineScript(value: string): string {
  return value.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new InProcessReviewSessionError(`${name} is required.`);
  }
  return value;
}
```

- [ ] **Step 4: Export new modules**

Modify `src/review/index.ts` to include:

```ts
export * from "./glimpse-review-surface.js";
export * from "./in-process-review-session.js";
```

Do not remove existing exports until the production command is switched in a later task.

- [ ] **Step 5: Run host tests**

Run:

```sh
pnpm test -- --run test/review/glimpse-review-surface.test.ts test/review/in-process-review-session.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```sh
git add src/review/glimpse-review-surface.ts src/review/index.ts test/review/glimpse-review-surface.test.ts
git commit -m "feat: add glimpse review surface"
```

---

## Task 7: Switch `/review` to Glimpse

**Files:**
- Modify: `src/index.ts`
- Modify: `test/review/agent-review.test.ts` only if notifications/assertions mention browser wording
- Modify: tests that mock `openBrowserReviewSurface`

- [ ] **Step 1: Update imports and call site**

In `src/index.ts`, replace:

```ts
import { openBrowserReviewSurface } from "./review/browser-review-surface.js";
```

with:

```ts
import { openGlimpseReviewSurface } from "./review/glimpse-review-surface.js";
```

Replace the production call:

```ts
const result = await openBrowserReviewSurface(snapshot, {
  seedDrafts,
  onSubmitPrompt: async (prompt) => {
    await ctx.ui?.setEditorText?.(prompt);
  }
});
```

with:

```ts
const result = await openGlimpseReviewSurface(snapshot, {
  seedDrafts,
  onSubmitPrompt: async (prompt) => {
    await ctx.ui?.setEditorText?.(prompt);
  }
});
```

If the actual call in `src/index.ts` has additional options, preserve all non-browser-specific options and remove `webDevServerUrl`, `assetsDir`, or `opener` options.

- [ ] **Step 2: Update user-facing notifications**

Change strings in `src/index.ts`:

```ts
"Browser review requires an interactive Pi UI."
```

to:

```ts
"Review mode requires an interactive Pi UI."
```

Change:

```ts
"Opening browser review for a frozen Git snapshot."
```

to:

```ts
"Opening native review window for a frozen Git snapshot."
```

Change fallback warnings such as:

```ts
"Opening the browser with no seeded comments."
```

to:

```ts
"Opening the review window with no seeded comments."
```

- [ ] **Step 3: Run focused extension tests**

Run:

```sh
pnpm test -- --run test/review/agent-review.test.ts test/review/fixture-review-source.test.ts test/review/review-command.test.ts
```

Expected: PASS after adjusting notification text expectations if any tests assert them.

- [ ] **Step 4: Commit**

```sh
git add src/index.ts test/review/agent-review.test.ts
git commit -m "feat: open review in glimpse window"
```

---

## Task 8: Remove HTTP server/browser surface production code

**Files:**
- Delete: `src/review/review-server.ts`
- Delete: `src/review/browser-review-surface.ts`
- Delete: `src/review/open-browser.ts`
- Delete: `src/review/review-session.ts` after confirming no imports remain
- Delete: `test/review/review-server.test.ts`
- Delete: `test/review/browser-review-surface.test.ts`
- Delete: `test/review/review-session.test.ts`
- Modify: `src/review/index.ts`
- Modify: `apps/review-web/src/api.ts` if HTTP-only code remains unused
- Modify: `apps/review-web/src/api.test.ts` if HTTP-only tests remain

- [ ] **Step 1: Find remaining HTTP/session imports**

Run:

```sh
rg "review-server|browser-review-surface|open-browser|ReviewServer|ReviewSession|createReviewApi|readTokenFromLocation|heartbeat|sendBeacon|/api/|token" src apps test
```

Expected before cleanup: matches in the files listed for deletion/modification.

- [ ] **Step 2: Remove server/session exports**

Modify `src/review/index.ts` to remove these lines:

```ts
export * from "./browser-review-surface.js";
export * from "./open-browser.js";
export * from "./review-server.js";
export * from "./review-session.js";
```

Keep exports for:

```ts
export * from "./glimpse-review-surface.js";
export * from "./in-process-review-session.js";
export * from "./diff-parser.js";
export * from "./frozen-snapshot.js";
export * from "./git-review-source.js";
export * from "./review-command.js";
export * from "./review-completion.js";
export * from "./review-prompt-builder.js";
export * from "./types.js";
```

- [ ] **Step 3: Delete backend HTTP files and tests**

Run:

```sh
rm src/review/review-server.ts \
  src/review/browser-review-surface.ts \
  src/review/open-browser.ts \
  src/review/review-session.ts \
  test/review/review-server.test.ts \
  test/review/browser-review-surface.test.ts \
  test/review/review-session.test.ts
```

- [ ] **Step 4: Remove HTTP API client code if no longer used**

If `apps/review-web/src/api.ts` still exports `createReviewApi`, `ReviewApi`, `readTokenFromLocation`, `readApiBaseUrlFromLocation`, or `closeReviewWithBeacon`, delete those exports and keep only normalization helpers. The final `api.ts` should be equivalent to:

```ts
import type {
  DiffAnchor,
  DiffHunk,
  DiffRow,
  ReviewFileSnapshot,
  ReviewSnapshot,
  SavedComment
} from "./types";

export function normalizeReviewSnapshotForTransport(payload: unknown): ReviewSnapshot {
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

export function normalizeSavedCommentsForTransport(payload: unknown): SavedComment[] {
  return unwrap<unknown[]>(payload, "drafts").map(normalizeSavedCommentForTransport);
}

export function normalizeSavedCommentForTransport(payload: unknown): SavedComment {
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
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
    source: raw.source === "agent" ? "agent" : "user"
  };
}

export const normalizeDraftForTest = normalizeSavedCommentForTransport;

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
```

- [ ] **Step 5: Re-run import search**

Run:

```sh
rg "review-server|browser-review-surface|open-browser|ReviewServer|ReviewSession|createReviewApi|readTokenFromLocation|heartbeat|sendBeacon|/api/|token" src apps test
```

Expected: no production matches. Acceptable remaining matches only in docs not touched by this task.

- [ ] **Step 6: Run tests and typecheck**

Run:

```sh
pnpm typecheck
pnpm test -- --run
```

Expected: PASS after deleting/updating stale tests.

- [ ] **Step 7: Commit**

```sh
git add -A src/review apps/review-web/src test/review
git commit -m "refactor: remove localhost review server"
```

---

## Task 9: Make Vite assets load correctly in Glimpse

**Files:**
- Modify: `apps/review-web/vite.config.ts`
- Modify: `package.json` if build/package metadata is wrong

- [ ] **Step 1: Set relative asset base**

Modify `apps/review-web/vite.config.ts` to include `base: "./"`:

```ts
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../../dist/review-web",
    emptyOutDir: true
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
```

If the existing config differs, preserve existing plugins/aliases and only add `base: "./"`.

- [ ] **Step 2: Build web assets**

Run:

```sh
pnpm build:web
```

Expected: PASS and `dist/review-web/index.html` references relative assets like `./assets/...`, not `/assets/...`.

Verify:

```sh
rg 'src="/|href="/' dist/review-web/index.html
```

Expected: no matches for built JS/CSS assets. If favicon or non-critical metadata matches, inspect manually and convert to relative paths if needed.

- [ ] **Step 3: Verify package contents include Glimpse-ready assets**

Run:

```sh
pnpm build
npm pack --dry-run
```

Expected tarball includes:

```txt
dist/extension/src/index.js
dist/extension/src/review/glimpse-review-surface.js
dist/review-web/index.html
dist/review-web/assets/...
package.json
README.md
CONTEXT.md
```

- [ ] **Step 4: Commit**

```sh
git add apps/review-web/vite.config.ts package.json
git commit -m "build: make review assets glimpse-loadable"
```

---

## Task 10: Update docs and domain language

**Files:**
- Modify: `CONTEXT.md`
- Modify: `README.md`
- Modify: `docs/prd/2026-05-12-native-review-mode-prd.md`
- Modify: `docs/agents/domain.md` if routing still says server/token for review surface changes only

- [ ] **Step 1: Update `CONTEXT.md` scope summary**

Change the extension summary from:

```md
2. Serves that snapshot through a tokenized localhost browser UI.
3. Stores review drafts only for the active session.
```

to:

```md
2. Opens a Glimpse-hosted native WebView for commenting on that frozen snapshot.
3. Stores review drafts in memory for the active native window session.
```

- [ ] **Step 2: Update domain terms**

Replace these terms:

```md
- **Draft**: a saved review comment stored server-side for the active review session.
- **Review session**: the short-lived server-side owner of the snapshot, token, drafts, heartbeat, close, and submit lifecycle.
- **Review surface**: the UI host used to collect comments. The MVP surface is a local browser.
```

with:

```md
- **Draft**: a saved review comment stored in memory for the active review window.
- **Review session**: the short-lived in-process owner of the snapshot, drafts, close, and submit lifecycle.
- **Review surface**: the UI host used to collect comments. The primary surface is a Glimpse native WebView that renders bundled web assets.
```

- [ ] **Step 3: Update responsibilities**

Replace the server/browser bullets with:

```md
- `src/review/in-process-review-session.ts` owns draft validation, seeded drafts, close, submit, and cleanup behavior without network auth.
- `src/review/glimpse-review-surface.ts` opens the Glimpse native WebView, loads bundled browser assets, bridges messages, and resolves on submit/close/error.
- `apps/review-web/**` renders the review UI and calls the active review transport.
- `apps/review-web/src/glimpse-transport.ts` sends request/response messages through `window.glimpse`.
- `apps/review-web/src/use-review-surface-state.ts` owns review surface state such as loading, drafts, active editors, collapsed files, and submit eligibility.
```

- [ ] **Step 4: Update architectural rules**

Remove:

```md
- Require token authorization for all review API endpoints.
- Bind review servers to localhost only.
- Browser submit must be blocked when there are no saved comments or when unsaved editors are open.
```

Add:

```md
- Glimpse bridge messages must never inspect or mutate the working tree; they operate only on the frozen snapshot and in-memory drafts.
- Native review submit must be blocked when there are no saved comments or when unsaved editors are open.
- Runtime review UI must use bundled local assets only.
```

Keep the existing bundled local assets rule if present; avoid duplicating it.

- [ ] **Step 5: Update README**

Change opening description to:

```md
Pi Review Mode is a Pi extension package that adds `/review`. It opens a Glimpse native review window for commenting on a frozen Git diff, then writes the submitted review prompt back into the active Pi editor with `ctx.ui.setEditorText`.
```

Remove dev-server instructions that depend on `PI_REVIEW_WEB_DEV_SERVER`. Replace with:

```md
For web UI work, run the Vite dev server for component development:

```sh
pnpm dev:web
```

The production `/review` command loads built assets from `dist/review-web` in a Glimpse native WebView. Rebuild before testing the live extension flow:

```sh
pnpm build
pi -e ./
```
```

Add Glimpse requirements:

```md
## Native window requirements

The review window is hosted by `glimpseui`.

- macOS: Xcode Command Line Tools provide `swiftc` for the native WKWebView host.
- Linux: Glimpse can use a Rust/GTK/WebKitGTK host when those development packages are installed, or its Chromium backend when a Chromium-based browser is available.
- Windows: Glimpse uses .NET 8 and WebView2.

If Glimpse cannot build or find a host, `/review` reports the Glimpse error and leaves the Pi editor unchanged.
```

Update smoke tests so “browser” becomes “native review window”.

- [ ] **Step 6: Add PRD amendment**

Append to `docs/prd/2026-05-12-native-review-mode-prd.md`:

```md
## Amendment: Glimpse native review surface

The implementation may replace the tokenized localhost browser surface with a Glimpse native WebView surface. In that architecture, the frozen snapshot and saved drafts remain in the Pi extension process, and the UI communicates through Glimpse request/response messages instead of HTTP endpoints.

This removes the need for localhost token authorization, heartbeat expiry, CORS handling, and a close endpoint. The security boundary becomes process ownership of the Glimpse child window plus the existing frozen snapshot invariant: the review UI must not inspect or mutate the working tree.

The user-visible behavior remains the same: `/review` opens a review UI, saved comments are submitted into a generated Markdown prompt, and Pi writes that prompt into the active editor without automatically sending it to the agent.
```

- [ ] **Step 7: Commit docs**

```sh
git add CONTEXT.md README.md docs/prd/2026-05-12-native-review-mode-prd.md docs/agents/domain.md
git commit -m "docs: describe glimpse review surface"
```

---

## Task 11: Full verification and manual smoke

**Files:**
- No source changes expected unless verification finds issues.

- [ ] **Step 1: Run formatting/linting**

Run:

```sh
pnpm biome:check
```

Expected: PASS. If formatting fails, run:

```sh
pnpm biome:format
pnpm biome:check
```

Commit formatting changes if any:

```sh
git add -A
git commit -m "style: format glimpse review changes"
```

- [ ] **Step 2: Run typecheck**

Run:

```sh
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Run all tests**

Run:

```sh
pnpm test -- --run
```

Expected: PASS.

- [ ] **Step 4: Run full build**

Run:

```sh
pnpm build
```

Expected: PASS. Confirm built files exist:

```sh
test -f dist/extension/src/review/glimpse-review-surface.js
test -f dist/review-web/index.html
```

Expected: both commands exit 0.

- [ ] **Step 5: Inspect package tarball**

Run:

```sh
npm pack --dry-run
```

Expected: package contains built extension and web assets, and does not contain source-only assets as the runtime entry.

- [ ] **Step 6: Manual smoke: fixture review**

Run:

```sh
PI_REVIEW_MODE_FIXTURES=1 pi -e ./
```

In Pi:

```text
/review --fixture basic
```

Expected:

1. A Glimpse native review window opens.
2. The diff renders from the frozen fixture snapshot.
3. Add a file or line comment.
4. Finish Review closes/resolves the review.
5. The generated Markdown appears in the Pi editor.
6. The prompt is not sent automatically.

- [ ] **Step 7: Manual smoke: close/cancel**

Run the fixture again:

```text
/review --fixture basic
```

Close the native window using the window close control.

Expected:

1. The Pi editor contents are unchanged.
2. Pi reports or returns to normal input without hanging.
3. A subsequent `/review --fixture basic` opens a fresh window with no stale drafts.

- [ ] **Step 8: Manual smoke: working tree**

Create a tracked edit and an untracked file, then run:

```text
/review
```

Expected:

1. Scope picker still works.
2. Working-tree review opens in Glimpse.
3. Submit writes the prompt to the editor.

- [ ] **Step 9: Manual smoke: branch review**

On a clean feature branch with committed changes, run:

```text
/review
```

Choose branch-vs-base.

Expected:

1. Branch review opens in Glimpse.
2. Comment and submit work.
3. Dirty working tree still blocks branch review before opening the window.

- [ ] **Step 10: Final commit if verification fixes were needed**

```sh
git status --short
```

Expected: clean working tree. If not clean because of fixes:

```sh
git add -A
git commit -m "fix: complete glimpse review verification"
```

---

## Self-Review

### Spec coverage

- Replaces localhost browser surface with Glimpse: Tasks 6, 7, 8.
- Removes token/heartbeat/onClose endpoint semantics: Tasks 2, 5, 8, 10.
- Keeps frozen snapshot and prompt generation: Tasks 2 and 6 reuse `resolveSnapshotAnchor` and `completeReview`.
- Keeps bundled local assets: Task 9.
- Keeps seeded agent comments: Tasks 2 and 6.
- Keeps editor write on submit: Task 7.
- Updates docs/manual smoke: Tasks 10 and 11.

### Placeholder scan

No `TBD`, `TODO`, or intentionally vague implementation steps remain. Each code-changing task includes concrete file paths, code snippets, commands, and expected outcomes.

### Type consistency

- Backend session type is `InProcessReviewSession` throughout Tasks 2, 6, and 8.
- Browser transport type is `ReviewTransport` throughout Tasks 3, 4, and 5.
- Glimpse surface entrypoint is `openGlimpseReviewSurface` throughout Tasks 6 and 7.
- UI bridge global is `window.__PI_REVIEW_RECEIVE__` in both browser transport and host send code.
