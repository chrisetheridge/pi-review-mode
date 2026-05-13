# Review Mode Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task.

## Goal

Build `/review` as a Pi extension, not as a Pi core feature. The extension opens a local browser UI for commenting on a frozen Git diff, then writes structured review feedback into the active Pi editor via the public extension API.

## Hard constraint

Do **not** modify Pi core or files under `packages/coding-agent/*`. Implement only extension/package files in this repository. Use public extension APIs only:

- `pi.registerCommand("review", ...)`
- `ctx.ui.select(...)`
- `ctx.ui.notify(...)`
- `ctx.ui.setEditorText(...)`
- `ctx.hasUI`
- `pi.exec(...)` or Node child-process helpers from inside the extension

## Architecture

The repository is an extension package. The extension registers `/review`, computes a frozen Git snapshot, serves a tokenized localhost browser UI, stores drafts server-side for the active review session, and writes the submitted Markdown prompt into the editor.

Git remains the source of truth. The browser is a client for one frozen snapshot and the server-side draft store. No review state is persisted after submit, close, timeout, or process exit.

## File structure

**Create/modify extension package files:**

- `package.json` — extension package metadata, dependencies, scripts, and Pi package entry.
- `tsconfig.json` — TypeScript config for extension/server code.
- `vitest.config.ts` — Node unit test config.
- `README.md` — installation and smoke-test instructions.
- `src/index.ts` — Pi extension entrypoint registering `/review`.

**Create extension review backend:**

- `src/review/types.ts` — shared review domain types.
- `src/review/review-command.ts` — parse `/review` args.
- `src/review/git-review-source.ts` — repo detection, scope availability, Git diff collection, stats, thresholds.
- `src/review/diff-parser.ts` — convert unified Git diff into files, hunks, rows, anchors.
- `src/review/review-session.ts` — token, drafts, heartbeat, close, submit lifecycle.
- `src/review/review-server.ts` — localhost HTTP server and API endpoints.
- `src/review/review-prompt-builder.ts` — Markdown prompt generation.
- `src/review/browser-review-surface.ts` — start server, open browser, wait for submit.
- `src/review/open-browser.ts` — platform-specific browser launch helper.
- `src/review/index.ts` — public internal exports.

**Create browser app:**

- `src/review-web/index.html`
- `src/review-web/src/main.tsx`
- `src/review-web/src/api.ts`
- `src/review-web/src/types.ts`
- `src/review-web/src/App.tsx`
- `src/review-web/src/components/FileTree.tsx`
- `src/review-web/src/components/FileDiff.tsx`
- `src/review-web/src/components/CommentEditor.tsx`
- `src/review-web/src/components/SavedCommentCard.tsx`
- `src/review-web/src/styles.css`
- `src/review-web/vite.config.ts`
- `src/review-web/tailwind.config.ts`

**Create tests:**

- `test/review/fixtures.ts`
- `test/review/review-command.test.ts`
- `test/review/git-review-source.test.ts`
- `test/review/diff-parser.test.ts`
- `test/review/review-prompt-builder.test.ts`
- `test/review/review-session.test.ts`
- `test/review/review-server.test.ts`
- `src/review-web/src/App.test.tsx`
- `src/review-web/src/components/FileTree.test.tsx`
- `src/review-web/src/components/FileDiff.test.tsx`

## Dependencies

Runtime dependencies:

- `@earendil-works/pi-coding-agent` for extension types.
- `gitdiff-parser` for unified diff parsing.

Browser/runtime dependencies:

- `@vitejs/plugin-react`
- `vite`
- `react`
- `react-dom`
- `tailwindcss`

Test dependencies:

- `typescript`
- `vitest`
- `@testing-library/react`
- `@testing-library/user-event`
- `jsdom`
- `@types/react`
- `@types/react-dom`

## Implementation tasks

### Task 1: Create extension package shell

**Files:**

- Modify/create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/index.ts`

**Steps:**

- [ ] Add package metadata and scripts:
  - `build`: compile extension code and build browser assets.
  - `test`: run Vitest.
  - `typecheck`: run `tsc --noEmit`.
  - Pi package metadata pointing to `./src/index.ts` as the extension entry.
- [ ] Add dependencies listed above.
- [ ] Create `src/index.ts` exporting a default extension factory.
- [ ] Register `/review` with `pi.registerCommand("review", { description, handler })`.
- [ ] Handler initially parses args, checks `ctx.hasUI`, and shows a placeholder notification.
- [ ] Verify with `npm install`, `npm run typecheck`, and `npm test -- --run`.

**Acceptance criteria:**

- [ ] No files under `packages/coding-agent/*` are modified.
- [ ] `/review` is registered by the extension entrypoint.
- [ ] Extension code typechecks.

### Task 2: Parse `/review` command arguments

**Files:**

- Create: `src/review/types.ts`
- Create: `src/review/review-command.ts`
- Create: `src/review/index.ts`
- Test: `test/review/review-command.test.ts`

**Steps:**

- [ ] Define review domain types needed by the command parser, including `ReviewCommandOptions`.
- [ ] Implement `parseReviewCommand(input: string): ReviewCommandOptions`.
- [ ] Support bare `/review`.
- [ ] Support `/review --base <branch>`.
- [ ] Reject unknown flags, missing branch names, and positional args.
- [ ] Unit-test parser behavior.

**Acceptance criteria:**

- [ ] Parser tests pass.
- [ ] Parser has no dependency on Pi core internals.

### Task 3: Build Git fixture helpers

**Files:**

- Create: `test/review/fixtures.ts`

**Steps:**

- [ ] Create temp Git repo helper with `git(args)`, `write(path, text)`, and `cleanup()`.
- [ ] Configure user name/email in the fixture.
- [ ] Commit an initial file.
- [ ] Reuse this helper in later Git source tests.

**Acceptance criteria:**

- [ ] Fixture compiles and cleans up temporary repos.

### Task 4: Detect Git repo state and review scopes

**Files:**

- Create: `src/review/git-review-source.ts`
- Test: `test/review/git-review-source.test.ts`

**Steps:**

- [ ] Implement `GitReviewSource` using extension-local code only.
- [ ] Detect repo root with `git rev-parse --show-toplevel`.
- [ ] Detect working-tree availability from `git status --porcelain=v1 --untracked-files=all`.
- [ ] Detect branch-vs-base availability in order:
  1. upstream target
  2. `origin/main`
  3. `origin/master`
  4. `main`
  5. `master`
- [ ] Enforce strict clean working tree for branch-vs-base.
- [ ] Surface unavailable reasons for UI display.
- [ ] Unit-test outside-repo, working-tree, branch, and dirty-tree behavior.

**Acceptance criteria:**

- [ ] Git source tests pass.
- [ ] Scope detection has clear user-facing error messages.

### Task 5: Generate frozen Git snapshots

**Files:**

- Modify: `src/review/types.ts`
- Modify: `src/review/git-review-source.ts`
- Test: `test/review/git-review-source.test.ts`

**Steps:**

- [ ] Define `ReviewScope`, `ReviewSnapshot`, `ReviewFileSnapshot`, `ReviewDiffStats`, and threshold constants.
- [ ] Implement `createSnapshot(scope)`.
- [ ] For working-tree review, include staged, unstaged, and untracked files as final diff against `HEAD`.
- [ ] For branch review, diff merge-base against `HEAD`.
- [ ] Enforce hard thresholds for file count and changed lines.
- [ ] Throw clear errors for empty and unavailable diffs.

**Acceptance criteria:**

- [ ] Tests cover working-tree snapshots with untracked files.
- [ ] Tests cover branch snapshots from merge-base to `HEAD`.
- [ ] Large diffs fail with a clear split-the-review message.

### Task 6: Parse unified diffs into files, hunks, rows, and anchors

**Files:**

- Create: `src/review/diff-parser.ts`
- Test: `test/review/diff-parser.test.ts`
- Modify: `src/review/git-review-source.ts`

**Steps:**

- [ ] Parse unified diff output with `gitdiff-parser`.
- [ ] Produce file snapshots with status, path, old path, metadata, additions, deletions, and binary flag.
- [ ] Produce hunks and rows for context/add/delete lines.
- [ ] Produce stable file and line anchors containing path, side, hunk index/header, line numbers, diff row index, and line text.
- [ ] Ensure repeated line text receives distinct anchor IDs.
- [ ] Handle binary files as file-level-only comment targets.

**Acceptance criteria:**

- [ ] Parser tests pass.
- [ ] Git snapshot tests pass using parsed files.

### Task 7: Build prompt generation

**Files:**

- Create: `src/review/review-prompt-builder.ts`
- Test: `test/review/review-prompt-builder.test.ts`

**Steps:**

- [ ] Implement `buildReviewPrompt(snapshot, drafts)`.
- [ ] Group comments by file in diff order.
- [ ] Put file-level comments before line-level comments.
- [ ] Include compact diff context for line comments.
- [ ] Include instructions that the agent must inspect current files because the review was based on a frozen snapshot.

**Acceptance criteria:**

- [ ] Prompt builder tests pass.
- [ ] Output is structured Markdown ready for `ctx.ui.setEditorText(prompt)`.

### Task 8: Implement ReviewSession lifecycle and server-side drafts

**Files:**

- Create: `src/review/review-session.ts`
- Test: `test/review/review-session.test.ts`

**Steps:**

- [ ] Generate an unguessable session token.
- [ ] Require token authorization for active sessions.
- [ ] Store one saved draft per anchor.
- [ ] Support list, save, delete, submit, heartbeat, expiry, and close.
- [ ] Reject submit with zero saved comments.
- [ ] Discard drafts after submit or close.

**Acceptance criteria:**

- [ ] Session lifecycle tests pass.

### Task 9: Implement localhost review server API

**Files:**

- Create: `src/review/review-server.ts`
- Test: `test/review/review-server.test.ts`
- Create: `test/fixtures/review-assets/index.html`

**Steps:**

- [ ] Bind HTTP server to `127.0.0.1` only.
- [ ] Serve bundled browser assets.
- [ ] Require token for all `/api/*` endpoints.
- [ ] Add endpoints:
  - `GET /api/snapshot`
  - `GET /api/drafts`
  - `POST /api/drafts`
  - `DELETE /api/drafts/:anchorId`
  - `POST /api/heartbeat`
  - `POST /api/close`
  - `POST /api/submit`
- [ ] Return `{ prompt }` on submit.
- [ ] Close the server after submit, close, expiry, or extension shutdown.

**Acceptance criteria:**

- [ ] Server tests pass.
- [ ] Unauthorized requests return 401.
- [ ] Server never binds to a public interface.

### Task 10: Add browser surface and browser opener

**Files:**

- Create: `src/review/browser-review-surface.ts`
- Create: `src/review/open-browser.ts`

**Steps:**

- [ ] Implement cross-platform browser launch:
  - macOS: `open`
  - Windows: `cmd /c start`
  - Linux: `xdg-open`
- [ ] Implement a browser surface that starts `ReviewServer`, opens the tokenized URL, waits for submit/close/expiry, then resolves with `{ prompt?, closed }`.
- [ ] Ensure shutdown cleanup closes active servers.

**Acceptance criteria:**

- [ ] Browser launch helper is isolated and injectable in tests.
- [ ] Browser surface resolves cleanly on submit, close, or expiry.

### Task 11: Wire `/review` command end-to-end

**Files:**

- Modify: `src/index.ts`
- Modify: `src/review/index.ts`

**Steps:**

- [ ] In the command handler, wait for idle if necessary using command context APIs.
- [ ] Parse the full command input as `/review ${args}`.
- [ ] Require `ctx.hasUI`; otherwise notify that browser review requires interactive/RPC UI support.
- [ ] Create `GitReviewSource` rooted at `ctx.cwd`.
- [ ] For bare `/review`, fetch available scopes and show `ctx.ui.select` with unavailable options excluded or clearly reported.
- [ ] For `/review --base <branch>`, skip the picker and create branch-vs-base scope directly.
- [ ] Create the frozen snapshot.
- [ ] Open browser review surface.
- [ ] If submitted, call `ctx.ui.setEditorText(prompt)`.
- [ ] If closed/cancelled, notify without changing editor contents.
- [ ] On errors, show `ctx.ui.notify(message, "error")`.

**Acceptance criteria:**

- [ ] `/review` works through the extension command, not Pi core routing.
- [ ] Submitted feedback appears in the active editor and is not automatically sent.
- [ ] Closing the browser leaves the editor unchanged.

### Task 12: Create review web app shell and API client

**Files:**

- Create browser app files under `src/review-web/*`.

**Steps:**

- [ ] Create Vite React app under `src/review-web`.
- [ ] Read `token` from the URL query string.
- [ ] Implement API client functions for snapshot, drafts, save, delete, heartbeat, close, and submit.
- [ ] Add basic loading, error, and empty states.
- [ ] Start periodic heartbeat while the app is mounted.
- [ ] Call close endpoint on explicit close.

**Acceptance criteria:**

- [ ] Browser app builds.
- [ ] API client includes token on every request.

### Task 13: Implement browser review UI and comment behavior

**Files:**

- Modify browser app components under `src/review-web/src/*`.

**Steps:**

- [ ] Render sticky sidebar file tree with status, stats, and per-file comment count.
- [ ] Render continuous unified diffs in the main pane.
- [ ] Support collapse/expand per file.
- [ ] Support file-level comments.
- [ ] Support line-level comments on visible diff rows.
- [ ] Support multiple unsaved editors.
- [ ] Save via button and `Cmd/Ctrl+Enter`.
- [ ] Cancel active editor via `Esc`.
- [ ] Render saved comment cards with edit/delete.
- [ ] Block submit with zero saved comments.
- [ ] Block submit while unsaved editors exist.

**Acceptance criteria:**

- [ ] Browser UI supports the full MVP comment flow.
- [ ] Binary files allow file-level comments only.

### Task 14: Add web UI component tests

**Files:**

- Create/modify:
  - `src/review-web/src/App.test.tsx`
  - `src/review-web/src/components/FileTree.test.tsx`
  - `src/review-web/src/components/FileDiff.test.tsx`

**Steps:**

- [ ] Test file tree rendering and file selection.
- [ ] Test diff row rendering for add/delete/context rows.
- [ ] Test file-level and line-level comment save behavior.
- [ ] Test submit blocking with no saved comments.
- [ ] Test submit blocking with unsaved editors.

**Acceptance criteria:**

- [ ] Web UI tests pass in jsdom.

### Task 15: Bundle review web assets with the extension

**Files:**

- Modify: `package.json`
- Modify: `src/review/browser-review-surface.ts`
- Modify: `src/review-web/vite.config.ts`

**Steps:**

- [ ] Configure Vite output to a deterministic bundled asset directory, e.g. `dist/review-web`.
- [ ] Configure extension build scripts so `npm run build` builds TypeScript and browser assets.
- [ ] Resolve asset directory at runtime from the extension package location.
- [ ] Ensure runtime does not fetch assets from a CDN.

**Acceptance criteria:**

- [ ] A built extension can serve browser assets without dev server.
- [ ] `npm run build` produces all runtime files.

### Task 16: Complete Git source edge cases

**Files:**

- Modify: `src/review/git-review-source.ts`
- Modify: `src/review/diff-parser.ts`
- Add tests as needed.

**Steps:**

- [ ] Handle renamed files.
- [ ] Handle deleted text files.
- [ ] Handle binary files.
- [ ] Handle file paths with spaces.
- [ ] Handle invalid `--base` branch.
- [ ] Handle merge-base failure.
- [ ] Add clear no-op behavior when there are no reviewable changes.
- [ ] Add warning path for large-but-under-hard-limit diffs.

**Acceptance criteria:**

- [ ] Edge-case tests pass.
- [ ] Errors are actionable for the user.

### Task 17: Add manual smoke docs

**Files:**

- Modify: `README.md`

**Steps:**

- [ ] Document local development with `pi -e ./src/index.ts`.
- [ ] Document project-local installation under `.pi/extensions` or package installation if this package is distributed.
- [ ] Add manual smoke steps for:
  - working-tree review
  - branch-vs-base review
  - `/review --base <branch>`
  - submit writes prompt into editor
  - close/cancel leaves editor unchanged
- [ ] Document that the extension does not modify Pi core.

**Acceptance criteria:**

- [ ] README is sufficient for another agent/user to install and manually verify the extension.

### Task 18: Final verification and cleanup

**Files:**

- Any touched extension/test/docs files.

**Steps:**

- [ ] Run `npm run typecheck`.
- [ ] Run `npm test -- --run`.
- [ ] Run `npm run build`.
- [ ] Run a manual smoke test in Pi using the extension.
- [ ] Search the diff for forbidden core paths: `packages/coding-agent`.
- [ ] Remove stale TODOs/placeholders.

**Acceptance criteria:**

- [ ] All automated checks pass.
- [ ] Manual smoke test passes.
- [ ] No Pi core files are modified.
- [ ] The final summary includes verification output.

## Suggested issue breakdown

1. **Create `/review` extension command shell** — AFK, blocked by none.
2. **Freeze Git review snapshots in the extension** — AFK, blocked by 1.
3. **Parse diffs into line/file anchors** — AFK, blocked by 2.
4. **Run tokenized localhost review server** — AFK, blocked by 3.
5. **Build browser review UI** — HITL if visual review is desired, otherwise AFK, blocked by 4.
6. **Generate prompt and write it into Pi editor** — AFK, blocked by 4 and 5.
7. **Package browser assets with the extension** — AFK, blocked by 5 and 6.
8. **Handle Git edge cases and safeguards** — AFK, blocked by 2 and 3.
9. **Add smoke docs and final verification** — AFK, blocked by all previous issues.
